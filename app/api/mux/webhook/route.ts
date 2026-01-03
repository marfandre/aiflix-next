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

      // Обновляем видео
      const { data: updatedFilm, error } = await supa
        .from('films')
        .update(patch)
        .eq('asset_id', asset_id as string)
        .select('id')
        .maybeSingle();

      if (error) throw error;

      // Извлечение цветов для hover preview: 5 кадров × 3 цвета = 15 цветов
      if (playback_id && updatedFilm?.id) {
        try {
          const sharp = (await import('sharp')).default;
          const quantizeMod = await import('quantize');
          const quantize = (quantizeMod.default || quantizeMod) as any;

          type RGB = [number, number, number];

          // Функция: RGB -> HEX
          const rgbToHex = ([r, g, b]: RGB): string => {
            const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
            const rr = clamp(r).toString(16).padStart(2, '0');
            const gg = clamp(g).toString(16).padStart(2, '0');
            const bb = clamp(b).toString(16).padStart(2, '0');
            return `#${rr}${gg}${bb}`.toUpperCase();
          };

          // Функция: вычисление насыщенности (0-100)
          const getSaturation = ([r, g, b]: RGB): number => {
            const max = Math.max(r, g, b) / 255;
            const min = Math.min(r, g, b) / 255;
            const l = (max + min) / 2;
            if (max === min) return 0;
            const d = max - min;
            return (l > 0.5 ? d / (2 - max - min) : d / (max + min)) * 100;
          };

          // Функция: извлечь 3 цвета из кадра (bg, secondary, accent)
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
            if (palette.length < 2) return palette.map(rgbToHex);

            // Background = самый частый (первый)
            const bg = palette[0];
            // Secondary = второй по частоте
            const secondary = palette[1];
            // Accent = самый насыщенный из топ-5
            const accent = palette.slice(0, 5).sort((a, b) => getSaturation(b) - getSaturation(a))[0];

            return [rgbToHex(bg), rgbToHex(secondary), rgbToHex(accent)];
          };

          // Извлекаем цвета из 5 кадров (1, 2, 3, 4, 5 секунды) параллельно
          const timestamps = [1, 2, 3, 4, 5];
          console.log(`Starting color extraction for playback_id: ${playback_id}`);

          const frameResults = await Promise.all(
            timestamps.map(async (time) => {
              try {
                const frameColors = await extractColorsFromFrame(time);
                console.log(`Frame ${time}s: extracted ${frameColors.length} colors:`, frameColors);
                return frameColors;
              } catch (err) {
                console.error(`Frame ${time}s: extraction failed:`, err);
                return [];
              }
            })
          );

          const allColors = frameResults.flat();
          console.log(`Total colors extracted: ${allColors.length}`, allColors);

          // Базовые 5 цветов (для обратной совместимости) — первый кадр
          const baseColors = allColors.slice(0, 5);

          // Сохраняем оба массива
          await supa
            .from('films')
            .update({
              colors: baseColors.length > 0 ? baseColors : null, // обратная совместимость
              colors_preview: allColors.length > 0 ? allColors : null // новые 15 цветов
            })
            .eq('id', updatedFilm.id);

          console.log(`Colors extracted for film ${updatedFilm.id}: base=${baseColors.length}, preview=${allColors.length}`);
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
