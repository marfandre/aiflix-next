// app/api/videos/colors/route.ts
// API для извлечения цветов из thumbnail видео (Mux)

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient as createService } from "@supabase/supabase-js";
import sharp from "sharp";

// Типы для quantize
type RGB = [number, number, number];
type QuantizeResult = {
    palette: () => RGB[];
};

// Динамический импорт quantize (CommonJS модуль)
let quantizeLib: ((pixels: RGB[], maxColors: number) => QuantizeResult | null) | null = null;

async function getQuantize() {
    if (!quantizeLib) {
        const mod = await import("quantize");
        quantizeLib = (mod.default || mod) as typeof quantizeLib;
    }
    return quantizeLib!;
}

// Утилиты
function rgbToHex(r: number, g: number, b: number): string {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    const rr = clamp(r).toString(16).padStart(2, "0");
    const gg = clamp(g).toString(16).padStart(2, "0");
    const bb = clamp(b).toString(16).padStart(2, "0");
    return `#${rr}${gg}${bb}`.toUpperCase();
}

function colorDistance(a: RGB, b: RGB): number {
    const dr = a[0] - b[0];
    const dg = a[1] - b[1];
    const db = a[2] - b[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

function removeSimilarColors(colors: RGB[], threshold: number = 25): RGB[] {
    const result: RGB[] = [];
    for (const color of colors) {
        const isSimilar = result.some((existing) => colorDistance(existing, color) < threshold);
        if (!isSimilar) {
            result.push(color);
        }
    }
    return result;
}

// MMCQ Palette Extraction
async function getMMCQPalette(buffer: Buffer, colorCount: number = 5): Promise<string[]> {
    const image = sharp(buffer).resize(300, 300, {
        fit: "inside",
        withoutEnlargement: true,
    });

    const { data, info } = await image.removeAlpha().raw().toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const channels = info.channels;

    if (channels < 3) {
        throw new Error("Ожидается как минимум 3 канала (RGB)");
    }

    const pixels: RGB[] = [];
    const totalPixels = width * height;
    const quality = 5;

    for (let i = 0; i < totalPixels; i += quality) {
        const idx = i * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        pixels.push([r, g, b]);
    }

    if (pixels.length === 0) {
        return [];
    }

    const quantize = await getQuantize();
    const result = quantize(pixels, colorCount * 2);

    if (!result) {
        return [];
    }

    const palette = result.palette();
    if (!palette || palette.length === 0) {
        return [];
    }

    const uniqueColors = removeSimilarColors(palette, 30);
    const finalColors = uniqueColors.slice(0, colorCount);

    return finalColors.map(([r, g, b]) => rgbToHex(r, g, b));
}

// API handler
export async function POST(req: NextRequest) {
    try {
        const { filmId, playbackId } = await req.json();

        if (!filmId) {
            return NextResponse.json({ error: "filmId is required" }, { status: 400 });
        }

        if (!playbackId) {
            return NextResponse.json({ error: "playbackId is required" }, { status: 400 });
        }

        // Проверка авторизации
        const supa = createRouteHandlerClient({ cookies });
        const {
            data: { user },
        } = await supa.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
        }

        // Скачиваем thumbnail из Mux
        const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1`;

        const response = await fetch(thumbnailUrl);
        if (!response.ok) {
            return NextResponse.json(
                { error: `Не удалось загрузить thumbnail: ${response.status}` },
                { status: 500 }
            );
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Извлекаем цвета
        const colors = await getMMCQPalette(buffer, 5);

        if (colors.length === 0) {
            return NextResponse.json({ error: "Не удалось извлечь цвета" }, { status: 500 });
        }

        // Сохраняем в базу
        const service = createService(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error: updateError } = await service
            .from("films")
            .update({ colors })
            .eq("id", filmId);

        if (updateError) {
            console.error("Update colors error:", updateError);
            return NextResponse.json(
                { error: updateError.message ?? "Ошибка сохранения цветов" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            filmId,
            colors,
        });
    } catch (err: any) {
        console.error("videos/colors error:", err);
        return NextResponse.json(
            { error: err?.message ?? "Server error" },
            { status: 500 }
        );
    }
}
