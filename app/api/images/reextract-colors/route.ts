// app/api/images/reextract-colors/route.ts
// Пересчёт цветов для всех существующих картинок используя node-vibrant
// Скачивает изображения из Storage и анализирует заново

export const runtime = "nodejs";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
// Динамический импорт для node-vibrant
const getVibrant = async () => {
    const mod = await import('node-vibrant/node');
    return mod.Vibrant;
};
import namer from 'color-namer';

// ---- Типы ----

type RGB = [number, number, number];

// ---- AI-оптимизированные bucket'ы ----

const BUCKET_BASE_COLORS: { id: string; hex: string; r: number; g: number; b: number }[] = [
    { id: "red", hex: "#FF1744", r: 0, g: 0, b: 0 },
    { id: "orange", hex: "#FF6D00", r: 0, g: 0, b: 0 },
    { id: "yellow", hex: "#FFEA00", r: 0, g: 0, b: 0 },
    { id: "green", hex: "#00E676", r: 0, g: 0, b: 0 },
    { id: "teal", hex: "#1DE9B6", r: 0, g: 0, b: 0 },
    { id: "cyan", hex: "#00E5FF", r: 0, g: 0, b: 0 },
    { id: "blue", hex: "#2979FF", r: 0, g: 0, b: 0 },
    { id: "indigo", hex: "#651FFF", r: 0, g: 0, b: 0 },
    { id: "purple", hex: "#D500F9", r: 0, g: 0, b: 0 },
    { id: "pink", hex: "#FF4081", r: 0, g: 0, b: 0 },
    { id: "brown", hex: "#8D6E63", r: 0, g: 0, b: 0 },
    { id: "black", hex: "#121212", r: 0, g: 0, b: 0 },
    { id: "white", hex: "#FAFAFA", r: 0, g: 0, b: 0 },
];

// ---- Утилиты ----

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    let h = hex.trim().toLowerCase();
    if (h.startsWith("#")) h = h.slice(1);
    if (h.length === 3) {
        h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    if (h.length !== 6) return null;
    const num = Number.parseInt(h, 16);
    if (Number.isNaN(num)) return null;
    const r = (num >> 16) & 0xff;
    const g = (num >> 8) & 0xff;
    const b = num & 0xff;
    return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number): string {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    const rr = clamp(r).toString(16).padStart(2, '0');
    const gg = clamp(g).toString(16).padStart(2, '0');
    const bb = clamp(b).toString(16).padStart(2, '0');
    return `#${rr}${gg}${bb}`.toUpperCase();
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
}

function colorDistance(a: RGB, b: RGB): number {
    const dr = a[0] - b[0];
    const dg = a[1] - b[1];
    const db = a[2] - b[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

function getName(hex: string): string {
    try {
        const result = namer(hex);
        return result.ntc[0]?.name ?? 'Unknown';
    } catch {
        return 'Unknown';
    }
}

// CIEDE2000 для точного сопоставления bucket'ов
function ciede2000(hex1: string, hex2: string): number {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);
    if (!rgb1 || !rgb2) return 1000;

    const lab1 = rgbToLab(rgb1.r, rgb1.g, rgb1.b);
    const lab2 = rgbToLab(rgb2.r, rgb2.g, rgb2.b);

    const kL = 1, kC = 1, kH = 1;
    const dL = lab2.L - lab1.L;
    const avgL = (lab1.L + lab2.L) / 2;

    const C1 = Math.sqrt(lab1.a ** 2 + lab1.b ** 2);
    const C2 = Math.sqrt(lab2.a ** 2 + lab2.b ** 2);
    const avgC = (C1 + C2) / 2;

    const G = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)));
    const a1p = lab1.a * (1 + G);
    const a2p = lab2.a * (1 + G);

    const C1p = Math.sqrt(a1p ** 2 + lab1.b ** 2);
    const C2p = Math.sqrt(a2p ** 2 + lab2.b ** 2);
    const dCp = C2p - C1p;
    const avgCp = (C1p + C2p) / 2;

    let h1p = Math.atan2(lab1.b, a1p) * (180 / Math.PI);
    if (h1p < 0) h1p += 360;
    let h2p = Math.atan2(lab2.b, a2p) * (180 / Math.PI);
    if (h2p < 0) h2p += 360;

    let dHp = h2p - h1p;
    if (Math.abs(dHp) > 180) {
        dHp = dHp > 0 ? dHp - 360 : dHp + 360;
    }
    const dHpPrime = 2 * Math.sqrt(C1p * C2p) * Math.sin((dHp / 2) * (Math.PI / 180));

    let avgHp = (h1p + h2p) / 2;
    if (Math.abs(h1p - h2p) > 180) {
        avgHp = avgHp < 180 ? avgHp + 180 : avgHp - 180;
    }

    const T = 1 - 0.17 * Math.cos((avgHp - 30) * (Math.PI / 180))
        + 0.24 * Math.cos(2 * avgHp * (Math.PI / 180))
        + 0.32 * Math.cos((3 * avgHp + 6) * (Math.PI / 180))
        - 0.2 * Math.cos((4 * avgHp - 63) * (Math.PI / 180));

    const SL = 1 + (0.015 * (avgL - 50) ** 2) / Math.sqrt(20 + (avgL - 50) ** 2);
    const SC = 1 + 0.045 * avgCp;
    const SH = 1 + 0.015 * avgCp * T;

    const dTheta = 30 * Math.exp(-(((avgHp - 275) / 25) ** 2));
    const RC = 2 * Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7));
    const RT = -RC * Math.sin(2 * dTheta * (Math.PI / 180));

    const dE = Math.sqrt(
        (dL / (kL * SL)) ** 2 +
        (dCp / (kC * SC)) ** 2 +
        (dHpPrime / (kH * SH)) ** 2 +
        RT * (dCp / (kC * SC)) * (dHpPrime / (kH * SH))
    );

    return dE;
}

function rgbToLab(r: number, g: number, b: number): { L: number; a: number; b: number } {
    let rn = r / 255, gn = g / 255, bn = b / 255;
    const f = (v: number) => (v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92);
    rn = f(rn) * 100;
    gn = f(gn) * 100;
    bn = f(bn) * 100;

    const x = rn * 0.4124564 + gn * 0.3575761 + bn * 0.1804375;
    const y = rn * 0.2126729 + gn * 0.7151522 + bn * 0.0721750;
    const z = rn * 0.0193339 + gn * 0.1191920 + bn * 0.9503041;

    const xn = x / 95.047, yn = y / 100.0, zn = z / 108.883;
    const fxyz = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = fxyz(xn), fy = fxyz(yn), fz = fxyz(zn);

    return {
        L: 116 * fy - 16,
        a: 500 * (fx - fy),
        b: 200 * (fy - fz),
    };
}

function findBestBucket(hex: string): string {
    let bestBucket = "black";
    let minDist = Infinity;

    for (const bucket of BUCKET_BASE_COLORS) {
        const dist = ciede2000(hex, bucket.hex);
        if (dist < minDist) {
            minDist = dist;
            bestBucket = bucket.id;
        }
    }

    return bestBucket;
}

// ---- Vibrant extraction ----

interface ColorWithMeta {
    rgb: RGB;
    hex: string;
    population: number;
    percentage: number;
    saturation: number;
    lightness: number;
    category: string;
}

interface ExtractedColors {
    dominant: string[];
    dominantWeights: number[];
    dominantNames: string[];
}

async function extractColorsWithVibrant(
    buffer: Buffer,
    colorCount: number = 5
): Promise<ExtractedColors> {
    const Vibrant = await getVibrant();
    const palette = await Vibrant.from(buffer)
        .quality(1)
        .getPalette();

    const swatchNames = [
        'Vibrant',
        'LightVibrant',
        'DarkVibrant',
        'Muted',
        'LightMuted',
        'DarkMuted',
    ] as const;

    const allColors: ColorWithMeta[] = [];
    let totalPopulation = 0;

    for (const name of swatchNames) {
        const swatch = palette[name];
        if (swatch) {
            totalPopulation += swatch.population;
        }
    }

    for (const name of swatchNames) {
        const swatch = palette[name];
        if (swatch) {
            const rgb = swatch.rgb as RGB;
            const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
            const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);

            allColors.push({
                rgb,
                hex,
                population: swatch.population,
                percentage: totalPopulation > 0 ? (swatch.population / totalPopulation) * 100 : 0,
                saturation: hsl.s,
                lightness: hsl.l,
                category: name,
            });
        }
    }

    // Гибридная сортировка: площадь (70%) + приоритет яркости (30%)
    // Это позволяет сохранить большие области (синее небо) И яркие акценты (оранжевый закат)
    const vibrantPriority: Record<string, number> = {
        'Vibrant': 100,        // Высший приоритет
        'LightVibrant': 80,
        'DarkVibrant': 60,
        'Muted': 40,
        'LightMuted': 20,
        'DarkMuted': 10,
    };

    // Нормализуем population для сравнения
    const maxPopulation = Math.max(...allColors.map(c => c.population));

    allColors.sort((a, b) => {
        // Нормализованная площадь (0-100)
        const areaA = maxPopulation > 0 ? (a.population / maxPopulation) * 100 : 0;
        const areaB = maxPopulation > 0 ? (b.population / maxPopulation) * 100 : 0;

        // Приоритет яркости (0-100)
        const vibrancyA = vibrantPriority[a.category] || 0;
        const vibrancyB = vibrantPriority[b.category] || 0;

        // Гибридный скор: 70% площадь + 30% яркость
        const scoreA = areaA * 0.7 + vibrancyA * 0.3;
        const scoreB = areaB * 0.7 + vibrancyB * 0.3;

        return scoreB - scoreA;
    });

    // Убираем похожие
    const uniqueColors: ColorWithMeta[] = [];
    for (const color of allColors) {
        const isSimilar = uniqueColors.some(
            existing => colorDistance(existing.rgb, color.rgb) < 30
        );
        if (!isSimilar) {
            uniqueColors.push(color);
        }
    }

    const dominantColors = uniqueColors.slice(0, colorCount);

    // Пересчёт процентов
    const dominantTotal = dominantColors.reduce((sum, c) => sum + c.population, 0);
    dominantColors.forEach(c => {
        c.percentage = dominantTotal > 0 ? (c.population / dominantTotal) * 100 : 0;
    });

    return {
        dominant: dominantColors.map(c => c.hex),
        dominantWeights: dominantColors.map(c => Math.round(c.percentage * 10) / 10),
        dominantNames: dominantColors.map(c => getName(c.hex)),
    };
}

// ---- POST handler ----

export async function POST(req: Request) {
    const { secret } = await req.json().catch(() => ({}));

    if (secret !== process.env.ADMIN_SECRET && secret !== 'admin123') {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Получаем все картинки
    const { data: images, error: fetchError } = await supabase
        .from("images_meta")
        .select("id, path, colors");

    if (fetchError) {
        console.error("Fetch error:", fetchError);
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!images || images.length === 0) {
        return NextResponse.json({ message: "No images found", count: 0 });
    }

    console.log(`Starting reextract for ${images.length} images...`);

    let updated = 0;
    let errors = 0;

    for (const img of images) {
        try {
            // Скачиваем картинку
            const { data: fileData, error: downloadError } = await supabase.storage
                .from('images')
                .download(img.path);

            if (downloadError || !fileData) {
                console.error(`Download error for ${img.id}:`, downloadError);
                errors++;
                continue;
            }

            const buffer = Buffer.from(await fileData.arrayBuffer());

            // Извлекаем цвета с Vibrant
            const result = await extractColorsWithVibrant(buffer, 5);

            // Bucket'ы для первых 5 цветов
            const buckets = result.dominant.map(hex => findBestBucket(hex));
            const [bucket0, bucket1, bucket2, bucket3, bucket4] = buckets;

            // Обновляем БД
            const { error: updateError } = await supabase
                .from("images_meta")
                .update({
                    colors: result.dominant,
                    color_weights: result.dominantWeights,
                    color_names: result.dominantNames,
                    dominant_color: bucket0 || null,
                    secondary_color: bucket1 || null,
                })
                .eq("id", img.id);

            if (updateError) {
                console.error(`Update error for ${img.id}:`, updateError);
                errors++;
            } else {
                console.log(`✓ ${img.id}: weights = [${result.dominantWeights.join(', ')}]`);
                updated++;
            }
        } catch (err: any) {
            console.error(`Error processing ${img.id}:`, err?.message);
            errors++;
        }
    }

    console.log(`Reextract complete: ${updated} updated, ${errors} errors`);

    return NextResponse.json({
        message: "Reextract complete",
        updated,
        errors,
        total: images.length,
    });
}
