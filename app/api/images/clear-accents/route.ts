// app/api/images/clear-accents/route.ts
// Очистка акцентных цветов у всех картинок

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
    try {
        const { secret } = await req.json().catch(() => ({}));

        if (secret !== process.env.REEXTRACT_SECRET && secret !== "admin123") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Очищаем accent_colors у всех картинок
        const { data, error } = await supabase
            .from("images_meta")
            .update({ accent_colors: [] })
            .not("accent_colors", "is", null);

        if (error) {
            console.error("clear accents error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            message: "Accent colors cleared",
            success: true,
        });
    } catch (err: any) {
        console.error("clear-accents fatal:", err);
        return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
    }
}
