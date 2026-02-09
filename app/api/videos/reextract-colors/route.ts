// app/api/videos/reextract-colors/route.ts
// API для переизвлечения цветов из существующих видео (preview + full)
// POST { filmId } — одно видео, POST { all: true } — все видео

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type RGB = [number, number, number];

const rgbToHex = ([r, g, b]: RGB): string => {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    const rr = clamp(r).toString(16).padStart(2, '0');
    const gg = clamp(g).toString(16).padStart(2, '0');
    const bb = clamp(b).toString(16).padStart(2, '0');
    return `#${rr}${gg}${bb}`.toUpperCase();
};

const MAX_FRAMES = 60;
const MUX_BATCH = 10; // Параллельных запросов к Mux за раз

// Получить все assets из Mux с duration
async function getMuxAssets(): Promise<Map<string, number>> {
    const muxTokenId = process.env.MUX_TOKEN_ID;
    const muxTokenSecret = process.env.MUX_TOKEN_SECRET;
    const durationMap = new Map<string, number>(); // playback_id -> duration

    if (!muxTokenId || !muxTokenSecret) return durationMap;

    try {
        // Загружаем все assets (пагинация)
        let page = 1;
        let hasMore = true;
        while (hasMore) {
            const res = await fetch(`https://api.mux.com/video/v1/assets?page=${page}&limit=100`, {
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${muxTokenId}:${muxTokenSecret}`).toString('base64'),
                },
            });
            if (!res.ok) break;
            const data = await res.json();
            const assets = data.data ?? [];
            for (const asset of assets) {
                if (asset.duration && asset.playback_ids) {
                    for (const pid of asset.playback_ids) {
                        durationMap.set(pid.id, asset.duration);
                    }
                }
            }
            hasMore = assets.length === 100;
            page++;
        }
    } catch (err) {
        console.error('Failed to fetch Mux assets:', err);
    }

    return durationMap;
}

// Обработка одного видео
async function processVideo(
    playback_id: string,
    filmId: string,
    duration: number,
    supa: any,
    sharp: any,
    quantize: any,
): Promise<{ ok: boolean; error?: string; fullFrames?: number }> {
    try {
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

            return [rgbToHex(palette[0]), rgbToHex(palette[1]), rgbToHex(palette[2])];
        };

        const extractBatch = async (timestamps: number[]): Promise<{ time: number; colors: string[] }[]> => {
            return Promise.all(
                timestamps.map(async (time) => {
                    try {
                        return { time, colors: await extractColorsFromFrame(time) };
                    } catch (err) {
                        return { time, colors: [] as string[] };
                    }
                })
            );
        };

        // === 1. Preview: первые 5 секунд ===
        const previewResults = await extractBatch([0, 1, 2, 3, 4]);
        const previewColors = previewResults.sort((a, b) => a.time - b.time).flatMap(r => r.colors);
        const baseColors = previewColors.slice(0, 5);

        // === 2. Full: вся длительность ===
        let fullColors: string[] = [];
        let fullInterval = 1;

        if (duration > 0) {
            const durationSec = Math.floor(duration);
            fullInterval = Math.max(1, Math.ceil(durationSec / MAX_FRAMES));
            const fullTimestamps: number[] = [];
            for (let t = 0; t < durationSec; t += fullInterval) {
                fullTimestamps.push(t);
            }

            const fullResults: { time: number; colors: string[] }[] = [];
            for (let i = 0; i < fullTimestamps.length; i += MUX_BATCH) {
                const batch = fullTimestamps.slice(i, i + MUX_BATCH);
                const batchResults = await extractBatch(batch);
                fullResults.push(...batchResults);
            }

            fullColors = fullResults.sort((a, b) => a.time - b.time).flatMap(r => r.colors);
        } else {
            fullColors = previewColors;
        }

        // === Сохраняем ===
        const { error: updateError } = await supa
            .from('films')
            .update({
                colors: baseColors.length > 0 ? baseColors : null,
                colors_preview: previewColors.length > 0 ? previewColors : null,
                colors_full: fullColors.length > 0 ? fullColors : null,
                colors_full_interval: fullInterval,
            })
            .eq('id', filmId);

        if (updateError) throw updateError;

        return { ok: true, fullFrames: Math.floor(fullColors.length / 3) };
    } catch (err: any) {
        return { ok: false, error: err?.message ?? 'unknown' };
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { filmId, playbackId, all } = body;

        const supa = createClient(SUPABASE_URL, SERVICE_KEY);
        const sharp = (await import('sharp')).default;
        const quantizeMod = await import('quantize');
        const quantize = (quantizeMod.default || quantizeMod) as any;

        // === Batch mode: обработать все видео ===
        if (all) {
            const { data: films, error } = await supa
                .from('films')
                .select('id, playback_id')
                .not('playback_id', 'is', null)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (!films || films.length === 0) {
                return NextResponse.json({ ok: true, message: 'No videos found', total: 0 });
            }

            // Получаем duration для всех видео из Mux
            console.log(`Batch: fetching durations for ${films.length} videos from Mux...`);
            const durationMap = await getMuxAssets();
            console.log(`Batch: got durations for ${durationMap.size} assets`);

            const results: { filmId: string; ok: boolean; error?: string; fullFrames?: number; duration?: number }[] = [];

            // Обрабатываем по одному (чтобы не перегрузить Mux)
            for (const film of films) {
                if (!film.playback_id) continue;
                const duration = durationMap.get(film.playback_id) ?? 0;
                console.log(`Processing ${film.id} (playback: ${film.playback_id}, duration: ${duration}s)...`);

                const result = await processVideo(film.playback_id, film.id, duration, supa, sharp, quantize);
                results.push({ filmId: film.id, ...result, duration });

                console.log(`  -> ${result.ok ? 'OK' : 'FAIL'} ${result.ok ? `(${result.fullFrames} frames)` : result.error}`);
            }

            const succeeded = results.filter(r => r.ok).length;
            const failed = results.filter(r => !r.ok).length;

            return NextResponse.json({
                ok: true,
                total: films.length,
                succeeded,
                failed,
                results,
            });
        }

        // === Single mode: одно видео ===
        if (!filmId && !playbackId) {
            return NextResponse.json({ error: 'filmId, playbackId, or {all: true} required' }, { status: 400 });
        }

        let query = supa.from('films').select('id, playback_id');
        if (filmId) {
            query = query.eq('id', filmId);
        } else {
            query = query.eq('playback_id', playbackId);
        }

        const { data: film, error: filmError } = await query.maybeSingle();
        if (filmError) throw filmError;
        if (!film) return NextResponse.json({ error: 'Film not found' }, { status: 404 });
        if (!film.playback_id) return NextResponse.json({ error: 'No playback_id' }, { status: 400 });

        // Получаем duration из Mux
        const durationMap = await getMuxAssets();
        const duration = durationMap.get(film.playback_id) ?? 0;

        const result = await processVideo(film.playback_id, film.id, duration, supa, sharp, quantize);

        if (!result.ok) {
            return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            filmId: film.id,
            fullFrames: result.fullFrames,
            duration: duration || 'unknown',
        });

    } catch (e: any) {
        console.error('Reextract colors error:', e);
        return NextResponse.json(
            { ok: false, error: e?.message ?? 'unknown' },
            { status: 500 }
        );
    }
}
