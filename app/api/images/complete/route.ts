// app/api/images/complete/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient as createService } from "@supabase/supabase-js";

type IncomingImage = {
  path?: string;
  colors?: string[] | null;
};

// ---- ТЕ ЖЕ КОРЗИНЫ, ЧТО И В media-search ----

const BUCKET_BASE_COLORS: { id: string; hex: string; r: number; g: number; b: number }[] =
  [
    { id: "yellow", hex: "#ffd60a", r: 0, g: 0, b: 0 },
    { id: "orange", hex: "#ff9500", r: 0, g: 0, b: 0 },
    { id: "red", hex: "#ff3b30", r: 0, g: 0, b: 0 },
    { id: "green", hex: "#34c759", r: 0, g: 0, b: 0 },
    { id: "teal", hex: "#00c7be", r: 0, g: 0, b: 0 },
    { id: "cyan", hex: "#32ade6", r: 0, g: 0, b: 0 },
    { id: "blue", hex: "#007aff", r: 0, g: 0, b: 0 },
    { id: "indigo", hex: "#5856d6", r: 0, g: 0, b: 0 },
    { id: "purple", hex: "#af52de", r: 0, g: 0, b: 0 },
    { id: "pink", hex: "#ff2d55", r: 0, g: 0, b: 0 },
    { id: "brown", hex: "#a2845e", r: 0, g: 0, b: 0 },
    { id: "gray", hex: "#8e8e93", r: 0, g: 0, b: 0 },
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

// ---- ROUTE ----

export async function POST(req: Request) {
  try {
    const {
      images, // основной вариант: массив
      path,
      colors,
      title,
      description,
      prompt,
      model,
      genres,
      mood,
      imageType,
    } = await req.json();

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

    const service = createService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Подготавливаем список картинок
    let imageList: IncomingImage[] = [];
    if (Array.isArray(images) && images.length > 0) {
      imageList = images;
    } else {
      if (!path) {
        return NextResponse.json({ error: "path is required" }, { status: 400 });
      }
      imageList = [{ path, colors }];
    }

    // 2. Общие поля для всех картинок
    const modelToSave =
      typeof model === "string" && model.trim()
        ? model.trim().toLowerCase()
        : null;

    const genresToSave =
      Array.isArray(genres) && genres.length
        ? genres
            .map((g: any) => String(g).trim())
            .filter(Boolean)
            .slice(0, 10)
        : null;

    const moodToSave =
      typeof mood === "string" && mood.trim()
        ? mood.trim().toLowerCase()
        : null;

    const imageTypeToSave =
      typeof imageType === "string" && imageType.trim()
        ? imageType.trim().toLowerCase()
        : null;

    // 3. Готовим строки для вставки
    const rowsToInsert = imageList.map((img) => {
      if (!img.path) {
        throw new Error("image.path is required for all images");
      }

      const rawColors: string[] =
        (Array.isArray(img.colors) && img.colors.length
          ? img.colors
          : Array.isArray(colors) && colors.length
          ? colors
          : []) as string[];

      const normalizedColors = rawColors
        .filter((c) => typeof c === "string")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 5);

      // слоты по "ведрам"
      const bucket0 = mapHexToBucket(normalizedColors[0]);
      const bucket1 = mapHexToBucket(normalizedColors[1]);
      const bucket2 = mapHexToBucket(normalizedColors[2]);
      const bucket3 = mapHexToBucket(normalizedColors[3]);
      const bucket4 = mapHexToBucket(normalizedColors[4]);

      return {
        user_id: user.id,
        path: img.path,
        title: title ?? null,
        description: description ?? null,
        prompt: prompt ?? null,

        // сырые HEX — для отображения палитры
        colors: normalizedColors.length ? normalizedColors : null,

        // корзины — для поиска
        dominant_color: bucket0 ?? null,
        secondary_color: bucket1 ?? null,
        third_color: bucket2 ?? null,
        fourth_color: bucket3 ?? null,
        fifth_color: bucket4 ?? null,

        model: modelToSave,
        genres: genresToSave,
        mood: moodToSave,
        image_type: imageTypeToSave,
      };
    });

    const { data, error: insError } = await service
      .from("images_meta")
      .insert(rowsToInsert)
      .select("id");

    if (insError) {
      console.error("images_meta insert error:", insError);
      return NextResponse.json(
        { error: insError.message ?? "Insert error" },
        { status: 500 }
      );
    }

    const ids = (data ?? []).map((r: any) => r.id);
    return NextResponse.json({ ids });
  } catch (err: any) {
    console.error("images/complete fatal:", err);
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
