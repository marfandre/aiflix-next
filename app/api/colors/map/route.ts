// app/api/colors/map/route.ts
// Агрегирует все основные цвета из images_meta для цветовой карты

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient as createService } from "@supabase/supabase-js";

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return { h: h * 360, s, l };
}

export async function GET() {
  try {
    const service = createService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Берём все цвета из images_meta (постранично)
    let allRows: { colors: string[] | null }[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await service
        .from("images_meta")
        .select("colors")
        .not("colors", "is", null)
        .range(from, from + pageSize - 1);

      if (error) {
        console.error("colors/map query error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data || data.length === 0) break;
      allRows = allRows.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // Подсчитываем частоту каждого цвета
    const colorCounts: Record<string, number> = {};

    for (const row of allRows) {
      const colors = row.colors as string[] | null;
      if (!colors) continue;
      for (const hex of colors) {
        if (!hex || typeof hex !== "string" || !hex.startsWith("#")) continue;
        const normalized = hex.toUpperCase();
        colorCounts[normalized] = (colorCounts[normalized] || 0) + 1;
      }
    }

    // Формируем массив с HSL для фронтенда
    const entries = Object.entries(colorCounts)
      .map(([hex, count]) => {
        const hsl = hexToHsl(hex);
        return { hex, count, h: Math.round(hsl.h), s: Math.round(hsl.s * 100), l: Math.round(hsl.l * 100) };
      })
      .sort((a, b) => a.h - b.h || b.count - a.count);

    return NextResponse.json({
      colors: entries,
      totalImages: allRows.length,
    });
  } catch (err: any) {
    console.error("colors/map fatal:", err);
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}
