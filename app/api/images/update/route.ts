// app/api/images/update/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient as createService } from "@supabase/supabase-js";

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
            updateData.colors = Array.isArray(colors) && colors.length
                ? colors.slice(0, 5)
                : null;
        }
        if (accent_colors !== undefined) {
            updateData.accent_colors = Array.isArray(accent_colors) && accent_colors.length
                ? accent_colors.slice(0, 3)
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
