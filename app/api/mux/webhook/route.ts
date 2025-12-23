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

      // Автоматическое извлечение цветов из thumbnail
      if (playback_id && updatedFilm?.id) {
        try {
          const thumbnailUrl = `https://image.mux.com/${playback_id}/thumbnail.jpg?time=1`;
          const response = await fetch(thumbnailUrl);

          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Извлекаем цвета с помощью sharp и quantize
            const sharp = (await import('sharp')).default;

            const image = sharp(buffer).resize(300, 300, {
              fit: 'inside',
              withoutEnlargement: true,
            });

            const { data: pixelData, info } = await image
              .removeAlpha()
              .raw()
              .toBuffer({ resolveWithObject: true });

            // Собираем пиксели для quantize
            type RGB = [number, number, number];
            const pixels: RGB[] = [];
            const totalPixels = info.width * info.height;
            const quality = 5;

            for (let i = 0; i < totalPixels; i += quality) {
              const idx = i * info.channels;
              pixels.push([pixelData[idx], pixelData[idx + 1], pixelData[idx + 2]]);
            }

            if (pixels.length > 0) {
              const quantizeMod = await import('quantize');
              const quantize = (quantizeMod.default || quantizeMod) as any;
              const result = quantize(pixels, 10);

              if (result) {
                const palette = result.palette() as RGB[];

                // Конвертируем в HEX
                const colors = palette.slice(0, 5).map(([r, g, b]: RGB) => {
                  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
                  const rr = clamp(r).toString(16).padStart(2, '0');
                  const gg = clamp(g).toString(16).padStart(2, '0');
                  const bb = clamp(b).toString(16).padStart(2, '0');
                  return `#${rr}${gg}${bb}`.toUpperCase();
                });

                // Сохраняем цвета
                await supa
                  .from('films')
                  .update({ colors })
                  .eq('id', updatedFilm.id);

                console.log(`Colors extracted for film ${updatedFilm.id}:`, colors);
              }
            }
          }
        } catch (colorErr) {
          // Не прерываем основной flow если цвета не получилось извлечь
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
