// app/api/media-search/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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

/**
 * БАЗОВЫЕ ЦВЕТА ПАЛИТРЫ (должны соответствовать кружкам в UI)
 * id — то, что будет храниться в БД в слоте (dominant_color и т.д.)
 */
const BUCKET_BASE_COLORS: { id: string; hex: string; r: number; g: number; b: number }[] =
  [
    { id: "yellow", hex: "#ffd60a", r: 0, g: 0, b: 0 }, // значения r/g/b перепишем ниже
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

// заполняем r/g/b у базовых цветов
for (const c of BUCKET_BASE_COLORS) {
  const rgb = hexToRgb(c.hex)!;
  c.r = rgb.r;
  c.g = rgb.g;
  c.b = rgb.b;
}

/**
 * mapHexToBucket:
 *  - принимает hex или что-то похожее;
 *  - возвращает id корзины (orange, blue, ...) или null, если не удалось распарсить.
 */
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

// ======================= GET =======================

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sp = url.searchParams;

  const types = (sp.get("types") ?? "images")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const includeVideo = types.includes("video");
  const includeImages = types.includes("images");

  const genresParam = sp.get("genres");
  const modelsParam = sp.get("models");
  const moodsParam = sp.get("moods");
  const imageTypesParam = sp.get("imageTypes");

  const colorsParam = sp.get("colors"); // палитра
  const slotColorParam = sp.get("slotColor"); // круг
  const slotIndexParam = sp.get("slotIndex");

  type FilmRow = {
    id: string;
    title: string | null;
    genres: string[] | null;
    model: string | null;
  };

  type ImageRow = {
    id: string;
    title: string | null;
    colors: string[] | null;
    genres: string[] | null;
    model: string | null;
    mood: string | null;
    image_type: string | null;
    dominant_color: string | null;
    secondary_color: string | null;
    third_color: string | null;
    fourth_color: string | null;
    fifth_color: string | null;
  };

  const films: FilmRow[] = [];
  const images: ImageRow[] = [];

  // ---------- FILMS ----------
  if (includeVideo) {
    let q = supabase
      .from("films")
      .select("id, title, genres, model")
      .order("created_at", { ascending: false })
      .limit(50);

    if (genresParam) {
      const genres = genresParam
        .split(",")
        .map((g) => g.trim().toLowerCase())
        .filter(Boolean);
      if (genres.length) {
        q = q.overlaps("genres", genres);
      }
    }

    if (modelsParam) {
      const models = modelsParam
        .split(",")
        .map((m) => m.trim().toLowerCase())
        .filter(Boolean);
      if (models.length) {
        const orClause = models.map((m) => `model.ilike.%${m}%`).join(",");
        q = q.or(orClause);
      }
    }

    const { data, error } = await q;
    if (error) {
      console.error("media-search films error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    films.push(...((data as FilmRow[]) ?? []));
  }

  // ---------- IMAGES ----------
  if (includeImages) {
    let q = supabase
      .from("images_meta")
      .select(
        "id, title, colors, genres, model, mood, image_type, dominant_color, secondary_color, third_color, fourth_color, fifth_color"
      )
      .order("created_at", { ascending: false })
      .limit(120);

    // 1. Точный поиск по слоту (вкладка "Круг")
    if (slotColorParam && slotIndexParam) {
      const bucket = mapHexToBucket(slotColorParam);
      const idx = parseInt(slotIndexParam, 10);

      let slotColumn: string | null = null;
      switch (idx) {
        case 0:
          slotColumn = "dominant_color";
          break;
        case 1:
          slotColumn = "secondary_color";
          break;
        case 2:
          slotColumn = "third_color";
          break;
        case 3:
          slotColumn = "fourth_color";
          break;
        case 4:
          slotColumn = "fifth_color";
          break;
        default:
          slotColumn = null;
      }

      if (slotColumn && bucket) {
        q = q.eq(slotColumn, bucket);
      }
    }

    // 2. Поиск по палитре (вкладка "Палитра"/HEX)
    //    Ищем любые картинки, у которых хотя бы один слот попал в один из выбранных bucket'ов
    if (colorsParam) {
      const buckets = colorsParam
        .split(",")
        .map((c) => mapHexToBucket(c.trim()))
        .filter((b): b is string => Boolean(b));

      const uniqueBuckets = Array.from(new Set(buckets));
      if (uniqueBuckets.length) {
        const orParts: string[] = [];
        for (const b of uniqueBuckets) {
          orParts.push(`dominant_color.eq.${b}`);
          orParts.push(`secondary_color.eq.${b}`);
          orParts.push(`third_color.eq.${b}`);
          orParts.push(`fourth_color.eq.${b}`);
          orParts.push(`fifth_color.eq.${b}`);
        }
        if (orParts.length) {
          q = q.or(orParts.join(","));
        }
      }
    }

    // 3. Жанры
    if (genresParam) {
      const genres = genresParam
        .split(",")
        .map((g) => g.trim().toLowerCase())
        .filter(Boolean);
      if (genres.length) {
        q = q.overlaps("genres", genres);
      }
    }

    // 4. Модели
    if (modelsParam) {
      const models = modelsParam
        .split(",")
        .map((m) => m.trim().toLowerCase())
        .filter(Boolean);
      if (models.length) {
        const orClause = models.map((m) => `model.ilike.%${m}%`).join(",");
        q = q.or(orClause);
      }
    }

    // 5. Настроение
    if (moodsParam) {
      const moods = moodsParam
        .split(",")
        .map((m) => m.trim().toLowerCase())
        .filter(Boolean);
      if (moods.length) {
        q = q.in("mood", moods);
      }
    }

    // 6. Тип изображения
    if (imageTypesParam) {
      const imageTypes = imageTypesParam
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      if (imageTypes.length) {
        q = q.in("image_type", imageTypes);
      }
    }

    const { data, error } = await q;
    if (error) {
      console.error("media-search images error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    images.push(...((data as ImageRow[]) ?? []));
  }

  return NextResponse.json({ films, images });
}

// ======================= POST =======================

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // пустое тело — ок
  }

  const includeImages = body.includeImages ?? true;
  const includeVideo = body.includeVideo ?? false;

  const params = new URLSearchParams();

  const types: string[] = [];
  if (includeVideo) types.push("video");
  if (includeImages) types.push("images");
  if (types.length) {
    params.set("types", types.join(","));
  }

  function pushArrayParam(name: string) {
    const value = body[name];
    if (!value) return;

    if (Array.isArray(value)) {
      const normalized = value
        .map((v) => String(v).trim().toLowerCase())
        .filter(Boolean);
      if (!normalized.length) return;
      params.set(name, normalized.join(","));
      return;
    }

    if (typeof value === "string" && value.trim()) {
      params.set(
        name,
        value
          .split(",")
          .map((v: string) => v.trim().toLowerCase())
          .filter(Boolean)
          .join(",")
      );
    }
  }

  pushArrayParam("colors");
  pushArrayParam("models");
  pushArrayParam("moods");
  pushArrayParam("imageTypes");
  pushArrayParam("genres");

  if (typeof body.slotColor === "string" && body.slotColor.trim()) {
    params.set("slotColor", body.slotColor.trim().toLowerCase());
    if (typeof body.slotIndex === "number") {
      params.set("slotIndex", String(body.slotIndex));
    }
  }

  const url = `/?${params.toString()}`;
  return NextResponse.json({ url });
}
