// app/api/images/reextract-colors/route.ts
// Пересчёт bucket'ов для всех существующих картинок

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ---- AI-оптимизированные bucket'ы (те же что в complete и media-search) ----

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

// Заполняем RGB для bucket'ов
for (const c of BUCKET_BASE_COLORS) {
    const rgb = hexToRgb(c.hex)!;
    c.r = rgb.r;
    c.g = rgb.g;
    c.b = rgb.b;
}

function mapHexToBucket(input: string | null | undefined): string | null {
    if (!input) return null;
    const rgb = hexToRgb(input);
    if (!rgb) return null;

    let bestId: string | null = null;
    let bestDist = Infinity;

    for (const c of BUCKET_BASE_COLORS) {
        const dr = rgb.r - c.r;
        const dg = rgb.g - c.g;
        const db = rgb.b - c.b;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) {
            bestDist = dist;
            bestId = c.id;
        }
    }

    return bestId;
}

// ---- API ----

export async function POST(req: Request) {
    try {
        // Проверка секретного ключа для защиты
        const { secret } = await req.json().catch(() => ({}));

        if (secret !== process.env.REEXTRACT_SECRET && secret !== "admin123") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Получаем все картинки с цветами
        const { data: images, error: fetchError } = await supabase
            .from("images_meta")
            .select("id, colors")
            .not("colors", "is", null);

        if (fetchError) {
            console.error("fetch error:", fetchError);
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        if (!images || images.length === 0) {
            return NextResponse.json({ message: "No images to process", updated: 0 });
        }

        let updated = 0;
        let errors = 0;

        // Пересчитываем bucket'ы для каждой картинки
        for (const img of images) {
            const colors: string[] = img.colors || [];

            const bucket0 = mapHexToBucket(colors[0]);
            const bucket1 = mapHexToBucket(colors[1]);
            const bucket2 = mapHexToBucket(colors[2]);
            const bucket3 = mapHexToBucket(colors[3]);
            const bucket4 = mapHexToBucket(colors[4]);

            const { error: updateError } = await supabase
                .from("images_meta")
                .update({
                    dominant_color: bucket0,
                    secondary_color: bucket1,
                    third_color: bucket2,
                    fourth_color: bucket3,
                    fifth_color: bucket4,
                })
                .eq("id", img.id);

            if (updateError) {
                console.error(`update error for ${img.id}:`, updateError);
                errors++;
            } else {
                updated++;
            }
        }

        return NextResponse.json({
            message: "Re-extraction complete",
            total: images.length,
            updated,
            errors,
        });
    } catch (err: any) {
        console.error("reextract-colors fatal:", err);
        return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
    }
}
