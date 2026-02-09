// app/api/mux/webhook/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
            if (palette.length < 3) return palette.map(rgbToHex);

            return [
              rgbToHex(palette[0]),
              rgbToHex(palette[1]),
              rgbToHex(palette[2]),
            ];
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

          // === 1. Preview: первые 5 секунд (как было) ===
          const previewTimestamps = [0, 1, 2, 3, 4];
          console.log(`Starting preview color extraction for playback_id: ${playback_id}`);

          const previewResults = await extractBatch(previewTimestamps);
          const previewColors = previewResults
            .sort((a, b) => a.time - b.time)
            .flatMap(r => r.colors);

          const baseColors = previewColors.slice(0, 5);
          console.log(`Preview colors: ${previewColors.length}, base: ${baseColors.length}`);

          // === 2. Full: вся длительность видео ===
          const duration = data?.duration ?? 0; // Mux присылает duration в секундах
          const MAX_FRAMES = 60;
          let fullColors: string[] = [];
          let fullInterval = 1;

          if (duration > 0) {
            const durationSec = Math.floor(duration);
            fullInterval = Math.max(1, Math.ceil(durationSec / MAX_FRAMES));
            const fullTimestamps: number[] = [];
            for (let t = 0; t < durationSec; t += fullInterval) {
              fullTimestamps.push(t);
            }

            console.log(`Full extraction: duration=${durationSec}s, interval=${fullInterval}s, frames=${fullTimestamps.length}`);

            // Извлекаем батчами по 10, чтобы не перегрузить Mux
            const BATCH_SIZE = 10;
            const fullResults: { time: number; colors: string[] }[] = [];
            for (let i = 0; i < fullTimestamps.length; i += BATCH_SIZE) {
              const batch = fullTimestamps.slice(i, i + BATCH_SIZE);
              const batchResults = await extractBatch(batch);
              fullResults.push(...batchResults);
            }

            fullColors = fullResults
              .sort((a, b) => a.time - b.time)
              .flatMap(r => r.colors);

            console.log(`Full colors extracted: ${fullColors.length} (${fullResults.filter(r => r.colors.length > 0).length} frames ok)`);
          } else {
            // Нет duration — используем preview как fallback
            fullColors = previewColors;
            console.log('No duration from Mux, using preview colors as full fallback');
          }

          // === Сохраняем все цвета в БД ===
          await supa
            .from('films')
            .update({
              colors: baseColors.length > 0 ? baseColors : null,
              colors_preview: previewColors.length > 0 ? previewColors : null,
              colors_full: fullColors.length > 0 ? fullColors : null,
              colors_full_interval: fullInterval,
            })
            .eq('id', updatedFilm.id);

          console.log(`Colors saved for film ${updatedFilm.id}: base=${baseColors.length}, preview=${previewColors.length}, full=${fullColors.length}, interval=${fullInterval}s`);
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
