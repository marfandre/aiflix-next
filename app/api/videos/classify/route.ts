// app/api/videos/classify/route.ts
// Тестовый эндпоинт для проверки CLIP классификации на существующих видео
// GET /api/videos/classify?playbackId=xxx

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { classifyColorMode } from "@/lib/classifyColorMode";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const playbackId = searchParams.get("playbackId");

        if (!playbackId) {
            return NextResponse.json(
                { error: "playbackId is required. Usage: /api/videos/classify?playbackId=xxx" },
                { status: 400 }
            );
        }

        // Получаем цвета для ΔE анализа
        // Берём кадры распределённые по всей длительности видео
        // Для теста используем широкий диапазон (0, 2, 5, 10, 15, 20 сек)
        // В реальном webhook используются fullColors которые уже покрывают всю длительность
        const timestamps = [0, 2, 5, 10, 15, 20];
        const allColors: string[] = [];

        // Динамический импорт sharp и quantize для извлечения цветов
        const sharp = (await import('sharp')).default;
        const quantizeMod = await import('quantize');
        const quantize = (quantizeMod.default || quantizeMod) as any;

        type RGB = [number, number, number];

        const rgbToHex = ([r, g, b]: RGB): string => {
            const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
            return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`.toUpperCase();
        };

        for (const time of timestamps) {
            try {
                const url = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}`;
                const response = await fetch(url);
                if (!response.ok) continue;

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

                if (pixels.length > 0) {
                    const result = quantize(pixels, 8);
                    if (result) {
                        const palette = result.palette() as RGB[];
                        const frameColors = palette.slice(0, 3).map(rgbToHex);
                        allColors.push(...frameColors);
                    }
                }
            } catch (err) {
                console.error(`Frame ${time}s error:`, err);
            }
        }

        // Запускаем классификацию
        const result = await classifyColorMode(playbackId);

        // Сохраняем color_mode в базу
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error: updateError } = await supabaseAdmin
            .from('films')
            .update({ color_mode: result.colorMode })
            .eq('playback_id', playbackId);

        return NextResponse.json({
            playbackId,
            thumbnailUrl: `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1`,
            extractedColors: allColors,
            framesAnalyzed: Math.floor(allColors.length / 3),
            saved: !updateError,
            saveError: updateError?.message ?? null,
            ...result,
        });
    } catch (err: any) {
        console.error("videos/classify error:", err);
        return NextResponse.json(
            { error: err?.message ?? "Server error" },
            { status: 500 }
        );
    }
}
