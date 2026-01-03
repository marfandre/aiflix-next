// app/api/videos/reextract-colors/route.ts
// API для переизвлечения цветов из существующих видео

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type RGB = [number, number, number];

// RGB -> HEX
const rgbToHex = ([r, g, b]: RGB): string => {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    const rr = clamp(r).toString(16).padStart(2, '0');
    const gg = clamp(g).toString(16).padStart(2, '0');
    const bb = clamp(b).toString(16).padStart(2, '0');
    return `#${rr}${gg}${bb}`.toUpperCase();
};

// Вычисление насыщенности (0-100)
const getSaturation = ([r, g, b]: RGB): number => {
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;
    if (max === min) return 0;
    const d = max - min;
    return (l > 0.5 ? d / (2 - max - min) : d / (max + min)) * 100;
};

export async function POST(req: NextRequest) {
    try {
        const { filmId, playbackId } = await req.json();

        if (!filmId && !playbackId) {
            return NextResponse.json({ error: 'filmId or playbackId required' }, { status: 400 });
        }

        const supa = createClient(SUPABASE_URL, SERVICE_KEY);

        // Получаем видео по filmId или playbackId
        let query = supa.from('films').select('id, playback_id');
        if (filmId) {
            query = query.eq('id', filmId);
        } else {
            query = query.eq('playback_id', playbackId);
        }

        const { data: film, error: filmError } = await query.maybeSingle();

        if (filmError) throw filmError;
        if (!film) {
            return NextResponse.json({ error: 'Film not found' }, { status: 404 });
        }
        if (!film.playback_id) {
            return NextResponse.json({ error: 'Film has no playback_id' }, { status: 400 });
        }

        const playback_id = film.playback_id;
        const resolvedFilmId = film.id;

        // Импортируем модули
        const sharp = (await import('sharp')).default;
        const quantizeMod = await import('quantize');
        const quantize = (quantizeMod.default || quantizeMod) as any;

        // Функция извлечения 3 цветов из кадра
        const extractColorsFromFrame = async (time: number): Promise<string[]> => {
            const url = `https://image.mux.com/${playback_id}/thumbnail.jpg?time=${time}`;
            console.log(`Fetching frame at ${time}s: ${url}`);

            const response = await fetch(url);
            if (!response.ok) {
                console.log(`Frame at ${time}s: fetch failed with status ${response.status}`);
                return [];
            }

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

            // Просто берём топ-3 по частоте (без интерпретации)
            return [
                rgbToHex(palette[0]),  // Самый частый
                rgbToHex(palette[1]),  // Второй
                rgbToHex(palette[2]),  // Третий
            ];
        };

        // Извлекаем цвета из 5 кадров (каждую секунду первых 5 сек)
        const timestamps = [1, 2, 3, 4, 5];
        console.log(`Starting color extraction for playback_id: ${playback_id}`);
        console.log(`Timestamps: ${timestamps.join(', ')}`);

        const frameResults = await Promise.all(
            timestamps.map(async (time) => {
                try {
                    const frameColors = await extractColorsFromFrame(time);
                    console.log(`Frame ${time}s: extracted ${frameColors.length} colors:`, frameColors);
                    return { time, colors: frameColors };
                } catch (err) {
                    console.error(`Frame ${time}s: extraction failed:`, err);
                    return { time, colors: [] as string[] };
                }
            })
        );

        // Сортируем по времени и собираем все цвета
        const allColors = frameResults
            .sort((a, b) => a.time - b.time)
            .flatMap(r => r.colors);

        console.log(`Total colors extracted: ${allColors.length}`, allColors);

        // Базовые 5 цветов (для обратной совместимости) — первый кадр
        const baseColors = allColors.slice(0, 5);

        // Сохраняем оба массива
        const { error: updateError } = await supa
            .from('films')
            .update({
                colors: baseColors.length > 0 ? baseColors : null,
                colors_preview: allColors.length > 0 ? allColors : null
            })
            .eq('id', resolvedFilmId);

        if (updateError) throw updateError;

        return NextResponse.json({
            ok: true,
            filmId,
            baseColors,
            previewColors: allColors,
            totalColors: allColors.length,
            framesProcessed: frameResults.filter(r => r.colors.length > 0).length
        });

    } catch (e: any) {
        console.error('Reextract colors error:', e);
        return NextResponse.json(
            { ok: false, error: e?.message ?? 'unknown' },
            { status: 500 }
        );
    }
}
