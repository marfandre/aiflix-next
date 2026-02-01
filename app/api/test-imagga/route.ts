// app/api/test-imagga/route.ts
// Тестовый эндпоинт для Imagga Color API

import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { imageUrl, apiKey, apiSecret } = await req.json();

        if (!imageUrl) {
            return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
        }

        if (!apiKey || !apiSecret) {
            return NextResponse.json({ error: "apiKey and apiSecret required" }, { status: 400 });
        }

        // Создаём Basic Auth
        const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

        console.log("Testing Imagga with URL:", imageUrl);

        // Запрос к Imagga Colors API
        const response = await fetch(
            `https://api.imagga.com/v2/colors?image_url=${encodeURIComponent(imageUrl)}`,
            {
                headers: {
                    Authorization: `Basic ${auth}`,
                },
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Imagga error:", data);
            return NextResponse.json({ error: data }, { status: response.status });
        }

        // Форматируем результат
        const colors = data.result?.colors;

        const result = {
            raw: data,
            summary: {
                background_colors: colors?.background_colors?.map((c: any) => ({
                    hex: c.html_code,
                    percent: c.percent,
                    name: c.closest_palette_color,
                })),
                foreground_colors: colors?.foreground_colors?.map((c: any) => ({
                    hex: c.html_code,
                    percent: c.percent,
                    name: c.closest_palette_color,
                })),
                image_colors: colors?.image_colors?.map((c: any) => ({
                    hex: c.html_code,
                    percent: c.percent,
                    name: c.closest_palette_color,
                })),
            },
        };

        return NextResponse.json(result);
    } catch (err: any) {
        console.error("test-imagga error:", err);
        return NextResponse.json({ error: err?.message }, { status: 500 });
    }
}
