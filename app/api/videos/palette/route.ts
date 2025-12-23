// app/api/videos/palette/route.ts
// API для динамического извлечения цветов из видео на заданном таймкоде

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

// Типы для quantize
type RGB = [number, number, number];
type QuantizeResult = {
    palette: () => RGB[];
};

// Динамический импорт quantize
let quantizeLib: ((pixels: RGB[], maxColors: number) => QuantizeResult | null) | null = null;

async function getQuantize() {
    if (!quantizeLib) {
        const mod = await import("quantize");
        quantizeLib = (mod.default || mod) as typeof quantizeLib;
    }
    return quantizeLib!;
}

function rgbToHex(r: number, g: number, b: number): string {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    const rr = clamp(r).toString(16).padStart(2, "0");
    const gg = clamp(g).toString(16).padStart(2, "0");
    const bb = clamp(b).toString(16).padStart(2, "0");
    return `#${rr}${gg}${bb}`.toUpperCase();
}

// MMCQ Palette Extraction
async function extractPalette(buffer: Buffer, colorCount: number = 5): Promise<string[]> {
    const image = sharp(buffer).resize(200, 200, {
        fit: "inside",
        withoutEnlargement: true,
    });

    const { data, info } = await image.removeAlpha().raw().toBuffer({ resolveWithObject: true });

    const pixels: RGB[] = [];
    const totalPixels = info.width * info.height;
    const quality = 3; // Faster sampling

    for (let i = 0; i < totalPixels; i += quality) {
        const idx = i * info.channels;
        pixels.push([data[idx], data[idx + 1], data[idx + 2]]);
    }

    if (pixels.length === 0) return [];

    const quantize = await getQuantize();
    const result = quantize(pixels, colorCount * 2);

    if (!result) return [];

    const palette = result.palette();
    if (!palette || palette.length === 0) return [];

    return palette.slice(0, colorCount).map(([r, g, b]) => rgbToHex(r, g, b));
}

// GET /api/videos/palette?playbackId=xxx&time=5
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const playbackId = searchParams.get("playbackId");
        const time = searchParams.get("time") ?? "1";

        if (!playbackId) {
            return NextResponse.json({ error: "playbackId is required" }, { status: 400 });
        }

        // Fetch thumbnail from Mux at specified time
        const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}`;

        const response = await fetch(thumbnailUrl, {
            headers: {
                'Accept': 'image/jpeg',
            },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch thumbnail: ${response.status}` },
                { status: 500 }
            );
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Extract colors
        const colors = await extractPalette(buffer, 5);

        return NextResponse.json({
            playbackId,
            time: parseFloat(time),
            colors,
        });
    } catch (err: any) {
        console.error("videos/palette error:", err);
        return NextResponse.json(
            { error: err?.message ?? "Server error" },
            { status: 500 }
        );
    }
}
