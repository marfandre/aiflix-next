// app/api/mux/webhook/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAspectRatioString } from '@/app/utils/aspectRatio';
// import { getImageEmbedding } from '@/lib/clipEmbedding'; // TODO: вернуть для кнопки "Похожие"

// Если используешь проверку подписи Mux — оставь/добавь её здесь.
// Ниже — упрощённый вариант без валидации подписи, чтобы не мешал типам.

type MuxEvent = {
  type: string;
  data: any;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  // Чтобы не было «молчаливых» падений при билде
  throw new Error(
    'Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
  );
}

export async function POST(req: NextRequest) {
  try {
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const event = (await req.json()) as MuxEvent;

    // --- разбор полезной нагрузки Mux ---
    const { type, data } = event ?? {};
    // Mux обычно присылает:
    // - video.asset.created  -> data.id (asset_id), data.upload_id
    // - video.asset.ready    -> data.id (asset_id), data.playback_ids: [{id, policy}]
    // - video.upload.created -> data.id (upload_id)
    // см. https://docs.mux.com/docs/webhooks#event-types

    if (!type || !data) {
      return NextResponse.json({ ok: true, skipped: 'no-event' }, { status: 200 });
    }

    // Что будем писать в films
    const patch: Record<string, any> = {};

    if (type === 'video.asset.created') {
      // Прилетает связь upload_id <-> asset_id
      const asset_id: string | undefined = data?.id;
      const upload_id: string | undefined = data?.upload_id;

      if (!asset_id && !upload_id) {
        return NextResponse.json({ ok: true, skipped: 'no-ids' }, { status: 200 });
      }

      if (asset_id) patch.asset_id = asset_id;
      if (upload_id) patch.upload_id = upload_id;
      patch.status = 'processing';

      if (upload_id) {
        const { error } = await supa
          .from('films')
          .update(patch)
          .eq('upload_id', upload_id);

        if (error) throw error;
      } else if (asset_id) {
        const { error } = await supa
          .from('films')
          .update(patch)
          .eq('asset_id', asset_id);

        if (error) throw error;
      }

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (type === 'video.asset.ready') {
      // Когда asset готов — появляется playback_id
      const asset_id: string | undefined = data?.id;
      const playback_ids: Array<{ id: string; policy: string }> | undefined =
        data?.playback_ids;

      const playback_id = playback_ids?.[0]?.id;
      if (!asset_id && !playback_id) {
        return NextResponse.json({ ok: true, skipped: 'no-playback' }, { status: 200 });
      }

      if (playback_id) patch.playback_id = playback_id;
      patch.status = 'ready';

      if (data?.aspect_ratio) {
        patch.aspect_ratio = data.aspect_ratio;
      } else if (data?.tracks && Array.isArray(data.tracks)) {
        const videoTrack = data.tracks.find((t: any) => t.type === 'video');
        if (videoTrack && videoTrack.max_width && videoTrack.max_height) {
          patch.aspect_ratio = getAspectRatioString(videoTrack.max_width, videoTrack.max_height);
        }
      }

      // Обновляем видео. Сначала пытаемся найти по asset_id (штатный случай)
      let { data: updatedFilm, error } = await supa
        .from('films')
        .update(patch)
        .eq('asset_id', asset_id as string)
        .select('id')
        .maybeSingle();

      // Если не нашли по asset_id, но у нас есть upload_id (фоллбек на случай пропуска события created)
      if (!updatedFilm && !error && data?.upload_id) {
        console.log(`Video not found by asset_id=${asset_id}, trying upload_id=${data.upload_id}`);

        // Важно: раз уж мы нашли ассет, запишем и asset_id в базу
        patch.asset_id = asset_id;

        const res = await supa
          .from('films')
          .update(patch)
          .eq('upload_id', data.upload_id)
          .select('id')
          .maybeSingle();

        updatedFilm = res.data;
        error = res.error;
      }

      if (error) throw error;

      if (!updatedFilm) {
        console.warn(`Video not found for asset_ready event. asset_id=${asset_id}, upload_id=${data?.upload_id}`);
        return NextResponse.json({ ok: true, skipped: 'not-found' }, { status: 200 });
      }

      // Извлечение цветов: preview (5 кадров) + full (вся длительность)
      if (playback_id && updatedFilm?.id) {
        try {
          const sharp = (await import('sharp')).default;
          const quantizeMod = await import('quantize');
          const quantize = (quantizeMod.default || quantizeMod) as any;

          type RGB = [number, number, number];

          // RGB -> HEX
          const rgbToHex = ([r, g, b]: RGB): string => {
            const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
            const rr = clamp(r).toString(16).padStart(2, '0');
            const gg = clamp(g).toString(16).padStart(2, '0');
            const bb = clamp(b).toString(16).padStart(2, '0');
            return `#${rr}${gg}${bb}`.toUpperCase();
          };

          // Извлечь 3 цвета из кадра
          const extractColorsFromFrame = async (time: number): Promise<string[]> => {
            const url = `https://image.mux.com/${playback_id}/thumbnail.jpg?time=${time}`;
            const response = await fetch(url);
            if (!response.ok) return [];

            const buffer = Buffer.from(await response.arrayBuffer());
            const { data: pixelData, info } = await sharp(buffer)
              .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
              .removeAlpha()
              .raw()
              .toBuffer({ resolveWithObject: true });

            const pixels: RGB[] = [];
            const totalPixels = info.width * info.height;
            for (let i = 0; i < totalPixels; i += 5) {
              const idx = i * info.channels;
              pixels.push([pixelData[idx], pixelData[idx + 1], pixelData[idx + 2]]);
            }

            if (pixels.length === 0) return [];

            const result = quantize(pixels, 8);
            if (!result) return [];

            const palette = result.palette() as RGB[];
            return palette.map(rgbToHex);
          };

          // --- Функция для параллельного извлечения из списка таймстемпов ---
          const extractBatch = async (timestamps: number[]): Promise<{ time: number; colors: string[] }[]> => {
            return Promise.all(
              timestamps.map(async (time) => {
                try {
                  const frameColors = await extractColorsFromFrame(time);
                  return { time, colors: frameColors };
                } catch (err) {
                  console.error(`Frame ${time}s: extraction failed:`, err);
                  return { time, colors: [] as string[] };
                }
              })
            );
          };

          // === 1. Базовые цвета: 3 кадра (25%, 50%, 75%) ===
          const duration = data?.duration ?? 0; // Mux присылает duration в секундах

          let previewTimestamps: number[] = [0, 1, 2, 3, 4];
          if (duration > 0) {
            previewTimestamps = [
              Math.max(0.5, duration * 0.25),
              Math.max(1, duration * 0.5),
              Math.max(1.5, duration * 0.75),
            ];
          }

          console.log(`Starting base color extraction for playback_id: ${playback_id} at times: ${previewTimestamps.join(', ')}`);

          const previewResults = await extractBatch(previewTimestamps);
          const previewColors = previewResults
            .sort((a, b) => a.time - b.time)
            .flatMap(r => r.colors);

          // baseColors вычислен ниже из previewColors
          console.log(`Base colors pool size: ${previewColors.length}`);

          // === Вычисляем 5 базовых цветов (max-distance greedy) из превью ===
          const allExtractedColors = previewColors;

          const hexToRgbBase = (hex: string): [number, number, number] => {
            const h = hex.replace('#', '');
            return [
              parseInt(h.substring(0, 2), 16),
              parseInt(h.substring(2, 4), 16),
              parseInt(h.substring(4, 6), 16),
            ];
          };

          const colorDist = (a: string, b: string): number => {
            const [r1, g1, b1] = hexToRgbBase(a);
            const [r2, g2, b2] = hexToRgbBase(b);
            return Math.sqrt((r2 - r1) ** 2 + (g2 - g1) ** 2 + (b2 - b1) ** 2);
          };

          let baseColors: string[] = [];
          if (allExtractedColors.length <= 5) {
            baseColors = allExtractedColors;
          } else {
            // Greedy max-distance: выбираем 5 самых разнообразных
            const selected = [allExtractedColors[0]];
            const remaining = allExtractedColors.slice(1);
            while (selected.length < 5 && remaining.length > 0) {
              let bestIdx = 0;
              let bestMinDist = -1;
              for (let i = 0; i < remaining.length; i++) {
                const minDist = Math.min(...selected.map(s => colorDist(s, remaining[i])));
                if (minDist > bestMinDist) {
                  bestMinDist = minDist;
                  bestIdx = i;
                }
              }
              selected.push(remaining[bestIdx]);
              remaining.splice(bestIdx, 1);
            }
            baseColors = selected;
          }

          console.log(`Base colors (diverse): ${baseColors.length} from ${allExtractedColors.length} candidates`);

          // === Классификация цветового режима (CLIP: none vs static) ===
          let colorMode = 'static'; // default
          try {
            const { classifyColorMode } = await import('@/lib/classifyColorMode');
            const classification = await classifyColorMode(playback_id);
            colorMode = classification.colorMode;
            console.log(`Color mode classified: ${colorMode} (CLIP: "${classification.clipLabel}")`);
          } catch (classifyErr) {
            console.error('Color mode classification error (using default "static"):', classifyErr);
          }

          // Авто-Тегирование (Imagga) отключено на бэкенде: теперь оно происходит на фронтенде перед загрузкой.

          // === Генерируем NTC-имена цветов для поиска ===
          let colorNames: string[] = [];
          try {
            const namer = (await import('color-namer')).default;
            const finalColors = baseColors.length > 0 ? baseColors : [];
            colorNames = finalColors.map((hex) => {
              try {
                const result = namer(hex);
                return result.ntc[0]?.name ?? '';
              } catch { return ''; }
            }).filter(Boolean);
          } catch (namerErr) {
            console.error('color-namer import error:', namerErr);
          }

          // === Сохраняем все данные в БД ===
          // Проверяем: если пользователь уже задал свои цвета на странице загрузки — не перезаписываем их
          const { data: existingFilm } = await supa
            .from('films')
            .select('colors')
            .eq('id', updatedFilm.id)
            .single();

          const userAlreadySetColors = existingFilm?.colors && existingFilm.colors.length > 0;

          const colorsToSave = userAlreadySetColors ? existingFilm.colors : (baseColors.length > 0 ? baseColors : null);

          // Если пользователь задал свои цвета — генерируем NTC-имена для них
          if (userAlreadySetColors && existingFilm.colors) {
            try {
              const namer = (await import('color-namer')).default;
              colorNames = existingFilm.colors.map((hex: string) => {
                try {
                  const result = namer(hex);
                  return result.ntc[0]?.name ?? '';
                } catch { return ''; }
              }).filter(Boolean);
            } catch { /* already logged */ }
          }

          await supa
            .from('films')
            .update({
              colors: colorsToSave,
              colors_preview: previewColors.length > 0 ? previewColors : null,
              color_mode: colorMode,
              color_names: colorNames.length > 0 ? colorNames : null,
            })
            .eq('id', updatedFilm.id);

          console.log(`Metadata saved for film ${updatedFilm.id}: base=${baseColors.length}, preview=${previewColors.length}, mode=${colorMode}`);

          // TODO: CLIP-эмбеддинг отключён. Вернуть для кнопки "Похожие"
        } catch (colorErr) {
          console.error('Color extraction error:', colorErr);
        }
      }

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Другие события просто подтверждаем
    return NextResponse.json({ ok: true, ignored: type }, { status: 200 });
  } catch (e: any) {
    // Чтобы видеть, что именно упало, и не ловить «500 без сообщения»
    console.error('MUX webhook error:', e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'unknown' },
      { status: 200 } // отвечаем 200, чтобы Mux не ретраил бесконечно
    );
  }
}
