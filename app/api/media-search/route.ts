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
 * БАЗОВЫЕ ЦВЕТА ПАЛИТРЫ (bucket'ы) - AI-оптимизированные
 */
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

// заполняем r/g/b у базовых цветов
for (const c of BUCKET_BASE_COLORS) {
  const rgb = hexToRgb(c.hex)!;
  c.r = rgb.r;
  c.g = rgb.g;
  c.b = rgb.b;
}

/**
 * mapHexToBucket: принимает hex, возвращает id корзины
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

/**
 * Название колонки по индексу слота
 */
function getSlotColumn(index: number): string | null {
  switch (index) {
    case 0: return "dominant_color";
    case 1: return "secondary_color";
    case 2: return "third_color";
    case 3: return "fourth_color";
    case 4: return "fifth_color";
    default: return null;
  }
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

  const tagsParam = sp.get("tags");      // новый параметр тегов
  const modelsParam = sp.get("models");

  // Старые параметры (обратная совместимость)
  const genresParam = sp.get("genres");
  const moodsParam = sp.get("moods");
  const imageTypesParam = sp.get("imageTypes");

  // === НОВЫЕ ПАРАМЕТРЫ ЦВЕТОВОГО ПОИСКА ===
  const colorMode = sp.get("colorMode"); // 'simple' | 'dominant' | null
  const colorsParam = sp.get("colors");  // для простого режима: "red,blue,green" (старый формат)
  const hexColorsParam = sp.get("hexColors"); // новый формат: "#FF1744,#00E676"

  // Для режима доминантности: slot0, slot1, slot2, slot3, slot4
  const slot0 = sp.get("slot0");
  const slot1 = sp.get("slot1");
  const slot2 = sp.get("slot2");
  const slot3 = sp.get("slot3");
  const slot4 = sp.get("slot4");

  // Старые параметры (для обратной совместимости)
  const slotColorParam = sp.get("slotColor");
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
    tags: string[] | null;
    model: string | null;
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
      const genres = genresParam.split(",").map((g) => g.trim().toLowerCase()).filter(Boolean);
      if (genres.length) {
        q = q.overlaps("genres", genres);
      }
    }

    if (modelsParam) {
      const models = modelsParam.split(",").map((m) => m.trim().toLowerCase()).filter(Boolean);
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
        "id, title, colors, tags, model, dominant_color, secondary_color, third_color, fourth_color, fifth_color"
      )
      .order("created_at", { ascending: false })
      .limit(120);

    // === ЦВЕТОВОЙ ПОИСК ===

    if (colorMode === "simple" && (colorsParam || hexColorsParam)) {
      // ПРОСТОЙ РЕЖИМ: ищем картинки где ВСЕ выбранные цвета есть (каждый в любом слоте)
      let buckets: string[] = [];

      if (hexColorsParam) {
        // Новый формат: hex-коды -> мапим в bucketы
        const hexColors = hexColorsParam.split(",").map((c) => c.trim()).filter(Boolean);
        buckets = hexColors.map((hex) => mapHexToBucket(hex)).filter(Boolean) as string[];
      } else if (colorsParam) {
        // Старый формат: bucket ID
        buckets = colorsParam
          .split(",")
          .map((c) => c.trim().toLowerCase())
          .filter(Boolean);
      }

      if (buckets.length) {
        // AND логика: для КАЖДОГО цвета — он должен быть хотя бы в одном слоте
        for (const bucket of buckets) {
          const orParts = [
            `dominant_color.eq.${bucket}`,
            `secondary_color.eq.${bucket}`,
            `third_color.eq.${bucket}`,
            `fourth_color.eq.${bucket}`,
            `fifth_color.eq.${bucket}`,
          ];
          q = q.or(orParts.join(","));
        }
      }
    } else if (colorMode === "dominant") {
      // РЕЖИМ ПО ДОМИНАНТНОСТИ: каждый заполненный слот должен совпадать
      const slotFilters: { column: string; value: string }[] = [];

      if (slot0) {
        const col = getSlotColumn(0);
        if (col) slotFilters.push({ column: col, value: slot0.toLowerCase() });
      }
      if (slot1) {
        const col = getSlotColumn(1);
        if (col) slotFilters.push({ column: col, value: slot1.toLowerCase() });
      }
      if (slot2) {
        const col = getSlotColumn(2);
        if (col) slotFilters.push({ column: col, value: slot2.toLowerCase() });
      }
      if (slot3) {
        const col = getSlotColumn(3);
        if (col) slotFilters.push({ column: col, value: slot3.toLowerCase() });
      }
      if (slot4) {
        const col = getSlotColumn(4);
        if (col) slotFilters.push({ column: col, value: slot4.toLowerCase() });
      }

      // Применяем ВСЕ фильтры (AND логика)
      for (const filter of slotFilters) {
        q = q.eq(filter.column as any, filter.value);
      }
    } else if (slotColorParam && slotIndexParam) {
      // Старый формат (обратная совместимость)
      const bucket = mapHexToBucket(slotColorParam);
      const idx = parseInt(slotIndexParam, 10);
      const slotColumn = getSlotColumn(idx);

      if (slotColumn && bucket) {
        q = q.eq(slotColumn as any, bucket);
      }
    } else if (colorsParam && !colorMode) {
      // Старый формат без colorMode (обратная совместимость)
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
        q = q.or(orParts.join(","));
      }
    }

    // Теги (новая система)
    if (tagsParam) {
      const tags = tagsParam.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
      if (tags.length) {
        q = q.overlaps("tags", tags);
      }
    }

    // Модели
    if (modelsParam) {
      const models = modelsParam.split(",").map((m) => m.trim().toLowerCase()).filter(Boolean);
      if (models.length) {
        const orClause = models.map((m) => `model.ilike.%${m}%`).join(",");
        q = q.or(orClause);
      }
    }

    // === Старые параметры (обратная совместимость) ===
    // Если пришли старые параметры — конвертируем в поиск по tags
    if (genresParam && !tagsParam) {
      const genres = genresParam.split(",").map((g) => g.trim().toLowerCase()).filter(Boolean);
      if (genres.length) {
        q = q.overlaps("tags", genres);
      }
    }
    if (moodsParam && !tagsParam) {
      const moods = moodsParam.split(",").map((m) => m.trim().toLowerCase()).filter(Boolean);
      if (moods.length) {
        q = q.overlaps("tags", moods);
      }
    }
    if (imageTypesParam && !tagsParam) {
      const imageTypes = imageTypesParam.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
      if (imageTypes.length) {
        q = q.overlaps("tags", imageTypes);
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
      const normalized = value.map((v) => String(v).trim().toLowerCase()).filter(Boolean);
      if (!normalized.length) return;
      params.set(name, normalized.join(","));
      return;
    }

    if (typeof value === "string" && value.trim()) {
      params.set(
        name,
        value.split(",").map((v: string) => v.trim().toLowerCase()).filter(Boolean).join(",")
      );
    }
  }

  pushArrayParam("colors");
  pushArrayParam("models");
  pushArrayParam("moods");
  pushArrayParam("imageTypes");
  pushArrayParam("genres");

  // Цветовой режим
  if (body.colorMode) {
    params.set("colorMode", body.colorMode);
  }

  // Слоты для режима доминантности
  for (let i = 0; i < 5; i++) {
    const slotKey = `slot${i}`;
    if (body[slotKey] && typeof body[slotKey] === "string") {
      params.set(slotKey, body[slotKey].trim().toLowerCase());
    }
  }

  // Старый формат (обратная совместимость)
  if (typeof body.slotColor === "string" && body.slotColor.trim()) {
    params.set("slotColor", body.slotColor.trim().toLowerCase());
    if (typeof body.slotIndex === "number") {
      params.set("slotIndex", String(body.slotIndex));
    }
  }

  const url = `/?${params.toString()}`;
  return NextResponse.json({ url });
}