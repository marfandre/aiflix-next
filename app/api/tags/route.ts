// app/api/tags/route.ts
// GET /api/tags - возвращает все теги, сгруппированные по категориям

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Кэш на уровне модуля (перезагружается при деплое)
let cachedTags: TagsResponse | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

type Tag = {
    id: string;
    name_ru: string;
    name_en: string;
    category: string;
};

type TagsResponse = {
    genre: Tag[];
    mood: Tag[];
    scene: Tag[];
    all: Tag[];
};

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    }
);

export async function GET() {
    try {
        // Проверяем кэш
        if (cachedTags && Date.now() - cacheTime < CACHE_TTL) {
            return NextResponse.json(cachedTags, {
                headers: {
                    "Cache-Control": "public, max-age=300", // 5 минут
                },
            });
        }

        const { data, error } = await supabase
            .from("tags")
            .select("id, name_ru, name_en, category")
            .order("name_en", { ascending: true });

        if (error) {
            console.error("tags API error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const tags = (data ?? []) as Tag[];

        const response: TagsResponse = {
            genre: tags.filter((t) => t.category === "genre"),
            mood: tags.filter((t) => t.category === "mood"),
            scene: tags.filter((t) => t.category === "scene"),
            all: tags,
        };

        // Обновляем кэш
        cachedTags = response;
        cacheTime = Date.now();

        return NextResponse.json(response, {
            headers: {
                "Cache-Control": "public, max-age=300",
            },
        });
    } catch (err: any) {
        console.error("tags API fatal:", err);
        return NextResponse.json(
            { error: err?.message ?? "Server error" },
            { status: 500 }
        );
    }
}
