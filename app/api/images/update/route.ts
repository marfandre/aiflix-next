// app/api/images/update/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient as createService } from "@supabase/supabase-js";

// --- HSL-based color family mapping (same as batch-generate) ---
function hexToFamily(hex: string): string {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return 'black';
    let r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2 * 100;
    let s = 0, h = 0;
    if (max !== min) {
        const d = max - min;
        s = (l > 50 ? d / (2 - max - min) : d / (max + min)) * 100;
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6 * 360;
        else if (max === g) h = ((b - r) / d + 2) / 6 * 360;
        else h = ((r - g) / d + 4) / 6 * 360;
    }
    if (s < 15) { if (l < 15) return 'black'; if (l > 70) return 'white'; return 'brown'; }
    if (s < 30) { if (l < 15) return 'black'; if (l < 50) return 'brown'; return 'pink'; }
    if (l < 8) return 'black';
    if (l > 95) return 'white';
    if (h >= 10 && h < 40 && l < 45 && s < 80) return 'brown';
    if (h < 15) return l > 70 ? 'pink' : 'red';
    if (h < 40) return 'orange';
    if (h < 65) return 'yellow';
    if (h < 160) return 'green';
    if (h < 185) return 'teal';
    if (h < 210) return 'cyan';
    if (h < 260) return 'blue';
    if (h < 290) return 'indigo';
    if (h < 330) return s > 40 && l > 40 ? 'pink' : 'purple';
    if (h < 346) return 'pink';
    return l > 70 || (l > 50 && s < 60) ? 'pink' : 'red';
}

const BUCKET_BASE_COLORS = [
    { id: "red", r: 255, g: 23, b: 68 },
    { id: "orange", r: 255, g: 109, b: 0 },
    { id: "yellow", r: 255, g: 234, b: 0 },
    { id: "green", r: 0, g: 230, b: 118 },
    { id: "teal", r: 29, g: 233, b: 182 },
    { id: "cyan", r: 0, g: 229, b: 255 },
    { id: "blue", r: 41, g: 121, b: 255 },
    { id: "indigo", r: 101, g: 31, b: 255 },
    { id: "purple", r: 213, g: 0, b: 249 },
    { id: "pink", r: 255, g: 64, b: 129 },
    { id: "brown", r: 141, g: 110, b: 99 },
    { id: "black", r: 18, g: 18, b: 18 },
    { id: "white", r: 250, g: 250, b: 250 },
];

function mapHexToBucket(hex: string): string | null {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return null;
    const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    let best = "", bestDist = Infinity;
    for (const c of BUCKET_BASE_COLORS) {
        const d = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2;
        if (d < bestDist) { bestDist = d; best = c.id; }
    }
    return best;
}

export async function POST(req: Request) {
    try {
        const {
            id,
            title,
            description,
            prompt,
            model,
            tags,
            colors,
            accent_colors,
            color_positions,
        } = await req.json();

        if (!id) {
            return NextResponse.json({ error: "id is required" }, { status: 400 });
        }

        // Проверяем авторизацию
        const supa = createRouteHandlerClient({ cookies });
        const {
            data: { user },
            error: userErr,
        } = await supa.auth.getUser();

        if (userErr) {
            console.error("auth.getUser error:", userErr);
        }
        if (!user) {
            return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
        }

        // Проверяем владельца картинки
        const { data: imageData, error: fetchErr } = await supa
            .from("images_meta")
            .select("user_id")
            .eq("id", id)
            .single();

        if (fetchErr || !imageData) {
            return NextResponse.json({ error: "Картинка не найдена" }, { status: 404 });
        }

        if (imageData.user_id !== user.id) {
            return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
        }

        // Используем service client для обхода RLS
        const service = createService(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Подготавливаем данные для обновления
        const updateData: Record<string, any> = {};

        if (title !== undefined) updateData.title = title || null;
        if (description !== undefined) updateData.description = description || null;
        if (prompt !== undefined) updateData.prompt = prompt || null;
        if (model !== undefined) {
            updateData.model = typeof model === "string" && model.trim()
                ? model.trim().toLowerCase()
                : null;
        }
        if (tags !== undefined) {
            updateData.tags = Array.isArray(tags) && tags.length
                ? tags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 10)
                : null;
        }
        if (colors !== undefined) {
            const finalColors = Array.isArray(colors) && colors.length
                ? colors.slice(0, 5)
                : null;
            updateData.colors = finalColors;

            // Пересчитываем color_families и dominant/secondary/third при изменении цветов
            if (finalColors && finalColors.length > 0) {
                updateData.color_families = finalColors.map((c: string) => hexToFamily(c));
                updateData.dominant_color = mapHexToBucket(finalColors[0]) ?? null;
                updateData.secondary_color = finalColors[1] ? mapHexToBucket(finalColors[1]) : null;
                updateData.third_color = finalColors[2] ? mapHexToBucket(finalColors[2]) : null;
            } else {
                updateData.color_families = null;
                updateData.dominant_color = null;
                updateData.secondary_color = null;
                updateData.third_color = null;
            }
        }
        if (accent_colors !== undefined) {
            updateData.accent_colors = Array.isArray(accent_colors) && accent_colors.length
                ? accent_colors.slice(0, 3)
                : null;
        }
        if (color_positions !== undefined) {
            updateData.color_positions = Array.isArray(color_positions) && color_positions.length
                ? color_positions.slice(0, 5)
                : null;
        }

        const { error: updateError } = await service
            .from("images_meta")
            .update(updateData)
            .eq("id", id);

        if (updateError) {
            console.error("images_meta update error:", updateError);
            return NextResponse.json(
                { error: updateError.message ?? "Update error" },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("images/update fatal:", err);
        return NextResponse.json(
            { error: err?.message ?? "Server error" },
            { status: 500 }
        );
    }
}
