// app/api/media-search/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import namer from 'color-namer';

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

// Преобразование HEX в HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l }; // Ахроматический (серый)
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    case b: h = ((r - g) / d + 4) / 6; break;
  }

  return { h: h * 360, s, l }; // h: 0-360, s: 0-1, l: 0-1
}

// =====================================================
// CIE Lab + CIEDE2000 - Самый точный алгоритм сравнения цветов
// =====================================================

type LabColor = { L: number; a: number; b: number };

/**
 * Линейное преобразование sRGB
 */
function srgbToLinear(c: number): number {
  const cn = c / 255;
  return cn <= 0.04045 ? cn / 12.92 : Math.pow((cn + 0.055) / 1.055, 2.4);
}

/**
 * Преобразование RGB → XYZ (D65)
 */
function rgbToXyz(r: number, g: number, b: number): { x: number; y: number; z: number } {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  return {
    x: lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375,
    y: lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750,
    z: lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041,
  };
}

/**
 * Преобразование XYZ → CIE Lab (D65)
 */
function xyzToLab(x: number, y: number, z: number): LabColor {
  const Xn = 0.95047, Yn = 1.0, Zn = 1.08883;
  const epsilon = 0.008856, kappa = 903.3;

  const xr = x / Xn, yr = y / Yn, zr = z / Zn;

  const fx = xr > epsilon ? Math.cbrt(xr) : (kappa * xr + 16) / 116;
  const fy = yr > epsilon ? Math.cbrt(yr) : (kappa * yr + 16) / 116;
  const fz = zr > epsilon ? Math.cbrt(zr) : (kappa * zr + 16) / 116;

  return {
    L: 116 * fy - 16,    // 0-100
    a: 500 * (fx - fy),  // примерно -128 до +128
    b: 200 * (fy - fz),  // примерно -128 до +128
  };
}

/**
 * Преобразование HEX → CIE Lab
 */
function hexToLab(hex: string): LabColor | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const xyz = rgbToXyz(rgb.r, rgb.g, rgb.b);
  return xyzToLab(xyz.x, xyz.y, xyz.z);
}

/**
 * CIEDE2000 - Самый точный алгоритм сравнения цветов
 * Учитывает нелинейности человеческого восприятия
 * 
 * Интерпретация:
 * 0-1:  Неразличимы
 * 1-2:  Едва заметная разница
 * 2-5:  Заметная разница при сравнении
 * 5-10: Очевидно разные оттенки
 * 10+:  Разные цвета
 */
function deltaE2000(lab1: LabColor, lab2: LabColor): number {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;

  // Весовые коэффициенты (стандартные значения)
  const kL = 1, kC = 1, kH = 1;

  // Вычисляем C' (модифицированная хрома)
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cab = (C1 + C2) / 2;

  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cab, 7) / (Math.pow(Cab, 7) + Math.pow(25, 7))));

  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  // Вычисляем h' (модифицированный оттенок)
  const h1p = Math.atan2(b1, a1p) * 180 / Math.PI + (b1 < 0 ? 360 : 0);
  const h2p = Math.atan2(b2, a2p) * 180 / Math.PI + (b2 < 0 ? 360 : 0);

  // Разницы
  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else {
    const dh = h2p - h1p;
    if (Math.abs(dh) <= 180) {
      dhp = dh;
    } else if (dh > 180) {
      dhp = dh - 360;
    } else {
      dhp = dh + 360;
    }
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * Math.PI / 360);

  // Средние значения
  const Lp = (L1 + L2) / 2;
  const Cp = (C1p + C2p) / 2;

  let Hp: number;
  if (C1p * C2p === 0) {
    Hp = h1p + h2p;
  } else {
    const hpSum = h1p + h2p;
    if (Math.abs(h1p - h2p) <= 180) {
      Hp = hpSum / 2;
    } else if (hpSum < 360) {
      Hp = (hpSum + 360) / 2;
    } else {
      Hp = (hpSum - 360) / 2;
    }
  }

  // Коэффициенты коррекции
  const T = 1
    - 0.17 * Math.cos((Hp - 30) * Math.PI / 180)
    + 0.24 * Math.cos(2 * Hp * Math.PI / 180)
    + 0.32 * Math.cos((3 * Hp + 6) * Math.PI / 180)
    - 0.20 * Math.cos((4 * Hp - 63) * Math.PI / 180);

  const dTheta = 30 * Math.exp(-Math.pow((Hp - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(Cp, 7) / (Math.pow(Cp, 7) + Math.pow(25, 7)));
  const SL = 1 + (0.015 * Math.pow(Lp - 50, 2)) / Math.sqrt(20 + Math.pow(Lp - 50, 2));
  const SC = 1 + 0.045 * Cp;
  const SH = 1 + 0.015 * Cp * T;
  const RT = -Math.sin(2 * dTheta * Math.PI / 180) * RC;

  // Финальная формула
  const dE = Math.sqrt(
    Math.pow(dLp / (kL * SL), 2) +
    Math.pow(dCp / (kC * SC), 2) +
    Math.pow(dHp / (kH * SH), 2) +
    RT * (dCp / (kC * SC)) * (dHp / (kH * SH))
  );

  return dE;
}

/**
 * Chroma (насыщенность) в Lab пространстве
 */
function labChroma(lab: LabColor): number {
  return Math.sqrt(lab.a * lab.a + lab.b * lab.b);
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
    color_weights: number[] | null; // Веса цветов (процент площади)
    tags: string[] | null;
    model: string | null;
    path: string | null;
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
    // Новый алгоритм: прямое сравнение HEX-кодов с порогом расстояния
    const searchHexColors: string[] = hexColorsParam
      ? hexColorsParam.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean)
      : [];

    const useDirectColorSearch = colorMode === "simple" && searchHexColors.length > 0;

    // Если ищем по цвету — загружаем все картинки и фильтруем в JS
    // Если нет — используем обычные SQL-фильтры
    let q: any = supabase
      .from("images_meta")
      .select(
        "id, title, colors, color_weights, tags, model, path, dominant_color, secondary_color, third_color, fourth_color, fifth_color"
      )
      .order("created_at", { ascending: false });

    // Если НЕ цветовой поиск — ограничиваем количество
    if (!useDirectColorSearch) {
      q = q.limit(120);
    } else {
      // Для цветового поиска загружаем больше и фильтруем в JS
      q = q.not("colors", "is", null).limit(500);
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

    let resultImages = (data as ImageRow[]) ?? [];

    // === ПРИОРИТЕТНЫЙ МЕТОД: NTC-based поиск по названиям цветов ===
    // Получаем NTC названия + соседние цвета (distance < 2.0) для расширенного поиска
    if (useDirectColorSearch && resultImages.length > 0) {
      // Получаем NTC названия и соседей для искомых цветов
      const searchColorNamesSet = new Set<string>();

      searchHexColors.forEach((hex) => {
        try {
          const result = namer(hex);
          // Берём все NTC цвета с distance < 2.0 (визуально почти одинаковые)
          result.ntc.forEach((color) => {
            if (color.distance < 2.0) {
              searchColorNamesSet.add(color.name.toLowerCase());
            }
          });
        } catch {
          // ignore
        }
      });

      const searchColorNames = Array.from(searchColorNamesSet);
      console.log(`NTC search: looking for colors: ${searchColorNames.join(', ')}`);

      if (searchColorNames.length > 0) {
        // Фильтруем картинки по NTC названиям (включая соседей)
        const ntcFilteredImages = resultImages.filter((img) => {
          const imgColorNames = (img as any).color_names || [];
          if (!Array.isArray(imgColorNames) || imgColorNames.length === 0) {
            return false;
          }

          // Хотя бы один из искомых цветов должен быть в палитре картинки
          return searchColorNames.some((searchName) =>
            imgColorNames.some((imgName: string) =>
              imgName.toLowerCase() === searchName
            )
          );
        });

        // Если нашли результаты по NTC — используем их
        if (ntcFilteredImages.length > 0) {
          resultImages = ntcFilteredImages;
          console.log(`NTC search found ${ntcFilteredImages.length} results`);
          // Пропускаем CIEDE2000 поиск — NTC дал результаты
        } else {
          // NTC не дал результатов — используем CIEDE2000 как fallback
          console.log(`NTC search found no results. Falling back to CIEDE2000.`);
        }
      }
    }

    // === FALLBACK: CIE Lab + CIEDE2000 СРАВНЕНИЕ ЦВЕТОВ ===
    // Используется когда NTC не дал результатов (старые картинки без color_names)
    if (useDirectColorSearch && resultImages.length > 0) {
      /**
       * CIEDE2000 - самый точный алгоритм сравнения цветов
       * CIE Lab масштаб: L = 0-100, Chroma = 0-130, Delta E = 0-100
       */

      // Пороги насыщенности (Chroma) в масштабе CIE Lab
      const CHROMA_SATURATED = 50;  // Выше = насыщенный цвет
      const CHROMA_MUTED = 25;      // Ниже = приглушённый цвет

      /**
       * Сравнивает два цвета используя CIEDE2000
       */
      function compareColors(searchHex: string, imageHex: string): { match: boolean; score: number } {
        const lab1 = hexToLab(searchHex);
        const lab2 = hexToLab(imageHex);
        if (!lab1 || !lab2) return { match: false, score: Infinity };

        const chroma1 = labChroma(lab1);
        const chroma2 = labChroma(lab2);

        // === ПРОВЕРКА ПО LIGHTNESS (L) ===
        // CIE Lab: L от 0 до 100
        // Тёмный цвет (L < 35) НЕ матчится со светлым (L > 75)
        const L_DARK = 35;
        const L_LIGHT = 75;

        if (lab1.L < L_DARK && lab2.L > L_LIGHT) {
          return { match: false, score: Infinity };
        }
        if (lab1.L > L_LIGHT && lab2.L < L_DARK) {
          return { match: false, score: Infinity };
        }

        // Большая разница в яркости (> 30) = не матч
        const lDiff = Math.abs(lab1.L - lab2.L);
        if (lDiff > 30) {
          return { match: false, score: Infinity };
        }

        // === ПРОВЕРКА ПО CHROMA (насыщенность) ===
        // Адаптивный порог CIEDE2000 (УЖЕСТОЧЁННЫЙ):
        // - Насыщенный цвет (C > 50): порог 7 — очень строго
        // - Средний (25-50): порог 10 — строго
        // - Приглушённый (C < 25): порог 15 — умеренно
        let deltaEThreshold: number;
        if (chroma1 > CHROMA_SATURATED) {
          deltaEThreshold = 7;
        } else if (chroma1 > CHROMA_MUTED) {
          deltaEThreshold = 10;
        } else {
          deltaEThreshold = 15;
        }

        // === КЛЮЧЕВАЯ ПРОВЕРКА 1: Hue angle (оттенок) ===
        // Если оттенок отличается больше чем на 25° — это разные цвета
        // Оранжевый Hue ≈ 50-60°, Бежевый Hue ≈ 70-90°
        const hue1 = Math.atan2(lab1.b, lab1.a) * 180 / Math.PI;
        const hue2 = Math.atan2(lab2.b, lab2.a) * 180 / Math.PI;
        let hueDiff = Math.abs(hue1 - hue2);
        if (hueDiff > 180) hueDiff = 360 - hueDiff; // Учитываем цикличность

        // Для насыщенных цветов — строгая проверка Hue
        if (chroma1 > 30 && chroma2 > 15 && hueDiff > 25) {
          return { match: false, score: Infinity };
        }

        // === КЛЮЧЕВАЯ ПРОВЕРКА 2: относительная разница в Chroma ===
        // Если Chroma отличается больше чем на 30% — это разные "типы" цвета
        const maxChroma = Math.max(chroma1, chroma2);
        const chromaRatio = Math.abs(chroma1 - chroma2) / maxChroma;
        if (chromaRatio > 0.3) {
          return { match: false, score: Infinity };
        }

        // Насыщенный цвет НЕ матчится с очень приглушённым
        if (chroma1 > CHROMA_SATURATED && chroma2 < CHROMA_MUTED * 0.5) {
          return { match: false, score: Infinity };
        }

        // Приглушённый не матчится с очень насыщенным
        if (chroma1 < CHROMA_MUTED * 0.7 && chroma2 > CHROMA_SATURATED * 1.5) {
          return { match: false, score: Infinity };
        }

        // Вычисляем CIEDE2000
        const dE = deltaE2000(lab1, lab2);

        if (dE > deltaEThreshold) {
          return { match: false, score: Infinity };
        }

        // Score: Delta E + штраф за разницу в Chroma и L
        const chromaDiff = Math.abs(chroma1 - chroma2);
        const score = dE + chromaDiff * 0.1 + lDiff * 0.05;

        return { match: true, score };
      }

      /**
       * Находит лучшее совпадение для искомого цвета среди палитры картинки
       * Учитывает позицию цвета (первые цвета = доминантные = важнее)
       */
      function findBestMatch(searchHex: string, imageColors: string[]): { match: boolean; score: number } {
        let bestScore = Infinity;
        let hasMatch = false;

        for (let i = 0; i < imageColors.length; i++) {
          const result = compareColors(searchHex, imageColors[i]);
          if (result.match) {
            // Бонус для доминантных цветов (первые в палитре)
            // Позиция 0 = бонус 0, позиция 4 = штраф 2
            const positionPenalty = i * 0.5;
            const adjustedScore = result.score + positionPenalty;

            if (adjustedScore < bestScore) {
              bestScore = adjustedScore;
              hasMatch = true;
            }
          }
        }

        return { match: hasMatch, score: bestScore };
      }

      // Фильтруем и считаем score для каждой картинки
      // Score учитывает вес цвета — больший вес = лучший результат
      const scoredImages: { img: ImageRow; score: number }[] = [];

      for (const img of resultImages) {
        const imgColors = (img.colors || []).map((c: string) => c.toLowerCase());
        const imgWeights = img.color_weights || [];
        if (imgColors.length === 0) continue;

        // Для каждого искомого цвета — проверяем есть ли похожий в картинке
        let allColorsMatch = true;
        let totalScore = 0;
        let totalWeight = 0;

        for (const searchHex of searchHexColors) {
          // Найти индекс совпадающего цвета для получения веса
          let bestMatchIndex = -1;
          let bestMatchScore = Infinity;

          for (let i = 0; i < imgColors.length; i++) {
            const result = compareColors(searchHex, imgColors[i]);
            if (result.match && result.score < bestMatchScore) {
              bestMatchScore = result.score;
              bestMatchIndex = i;
            }
          }

          if (bestMatchIndex === -1) {
            allColorsMatch = false;
            break;
          }

          // Вес цвета (если есть) или fallback по позиции
          const weight = imgWeights[bestMatchIndex] ?? (100 - bestMatchIndex * 20);
          totalWeight += weight;
          totalScore += bestMatchScore;
        }

        if (allColorsMatch) {
          // Совмещаем deltaE score и вес (weight) для финального скора
          // Высокий вес = низкий score (лучше)
          const avgDeltaE = totalScore / searchHexColors.length;
          const avgWeight = totalWeight / searchHexColors.length;
          // Инвертируем вес: 100 → 0, 0 → 100
          const weightScore = 100 - avgWeight;
          // Финальный скор: вес важнее чем deltaE
          const finalScore = weightScore * 2 + avgDeltaE;
          scoredImages.push({ img, score: finalScore });
        }
      }

      // Сортируем по близости (лучшие совпадения первыми)
      scoredImages.sort((a, b) => a.score - b.score);

      // Берём топ-50 результатов
      resultImages = scoredImages.slice(0, 50).map((s) => s.img);
    }

    images.push(...resultImages);
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