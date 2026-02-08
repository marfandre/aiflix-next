// app/api/palette/route.ts
// Алгоритм определения цветов на основе node-vibrant
// + NTC (Name That Color) для получения человеческих названий цветов

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
// Динамический импорт для node-vibrant
const getVibrant = async () => {
  const mod = await import('node-vibrant/node');
  return mod.Vibrant;
};
import namer from 'color-namer';

export const runtime = 'nodejs';

// =====================
// Утилиты
// =====================

type RGB = [number, number, number];

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const rr = clamp(r).toString(16).padStart(2, '0');
  const gg = clamp(g).toString(16).padStart(2, '0');
  const bb = clamp(b).toString(16).padStart(2, '0');
  return `#${rr}${gg}${bb}`.toUpperCase();
}

// Расстояние между цветами в RGB
function colorDistance(a: RGB, b: RGB): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Получить NTC имя цвета
function getName(hex: string): string {
  try {
    const result = namer(hex);
    return result.ntc[0]?.name ?? 'Unknown';
  } catch {
    return 'Unknown';
  }
}

// Конвертация RGB в HSL
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

// Конвертация RGB в LAB для Delta E
function rgbToLab(r: number, g: number, b: number): { L: number; a: number; b: number } {
  let rn = r / 255, gn = g / 255, bn = b / 255;
  const f = (v: number) => (v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92);
  rn = f(rn) * 100;
  gn = f(gn) * 100;
  bn = f(bn) * 100;

  const x = rn * 0.4124564 + gn * 0.3575761 + bn * 0.1804375;
  const y = rn * 0.2126729 + gn * 0.7151522 + bn * 0.0721750;
  const z = rn * 0.0193339 + gn * 0.1191920 + bn * 0.9503041;

  const xn = x / 95.047, yn = y / 100.0, zn = z / 108.883;
  const fxyz = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = fxyz(xn), fy = fxyz(yn), fz = fxyz(zn);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

// CIEDE2000 Delta E - перцептивное расстояние между цветами
function ciede2000(rgb1: RGB, rgb2: RGB): number {
  const lab1 = rgbToLab(rgb1[0], rgb1[1], rgb1[2]);
  const lab2 = rgbToLab(rgb2[0], rgb2[1], rgb2[2]);

  const kL = 1, kC = 1, kH = 1;
  const dL = lab2.L - lab1.L;
  const avgL = (lab1.L + lab2.L) / 2;

  const C1 = Math.sqrt(lab1.a ** 2 + lab1.b ** 2);
  const C2 = Math.sqrt(lab2.a ** 2 + lab2.b ** 2);
  const avgC = (C1 + C2) / 2;

  const G = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)));
  const a1p = lab1.a * (1 + G);
  const a2p = lab2.a * (1 + G);

  const C1p = Math.sqrt(a1p ** 2 + lab1.b ** 2);
  const C2p = Math.sqrt(a2p ** 2 + lab2.b ** 2);
  const dCp = C2p - C1p;
  const avgCp = (C1p + C2p) / 2;

  let h1p = Math.atan2(lab1.b, a1p) * (180 / Math.PI);
  if (h1p < 0) h1p += 360;
  let h2p = Math.atan2(lab2.b, a2p) * (180 / Math.PI);
  if (h2p < 0) h2p += 360;

  let dHp = h2p - h1p;
  if (Math.abs(dHp) > 180) {
    dHp = dHp > 0 ? dHp - 360 : dHp + 360;
  }
  const dHpPrime = 2 * Math.sqrt(C1p * C2p) * Math.sin((dHp / 2) * (Math.PI / 180));

  let avgHp = (h1p + h2p) / 2;
  if (Math.abs(h1p - h2p) > 180) {
    avgHp = avgHp < 180 ? avgHp + 180 : avgHp - 180;
  }

  const T = 1 - 0.17 * Math.cos((avgHp - 30) * (Math.PI / 180))
    + 0.24 * Math.cos(2 * avgHp * (Math.PI / 180))
    + 0.32 * Math.cos((3 * avgHp + 6) * (Math.PI / 180))
    - 0.2 * Math.cos((4 * avgHp - 63) * (Math.PI / 180));

  const SL = 1 + (0.015 * (avgL - 50) ** 2) / Math.sqrt(20 + (avgL - 50) ** 2);
  const SC = 1 + 0.045 * avgCp;
  const SH = 1 + 0.015 * avgCp * T;

  const dTheta = 30 * Math.exp(-(((avgHp - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7));
  const RT = -RC * Math.sin(2 * dTheta * (Math.PI / 180));

  const dE = Math.sqrt(
    (dL / (kL * SL)) ** 2 +
    (dCp / (kC * SC)) ** 2 +
    (dHpPrime / (kH * SH)) ** 2 +
    RT * (dCp / (kC * SC)) * (dHpPrime / (kH * SH))
  );

  return dE;
}

// =====================
// Интерфейсы
// =====================

interface ColorWithMeta {
  rgb: RGB;
  hex: string;
  population: number;
  percentage: number;
  saturation: number;
  lightness: number;
  category: string; // Vibrant, Muted, DarkVibrant, etc.
}

interface ColorPosition {
  hex: string;
  x: number; // 0-1 относительная координата
  y: number;
}

interface ExtractedColors {
  dominant: string[];
  dominantWeights: number[];
  accent: string[];
  dominantNames: string[];
  accentNames: string[];
  colorPositions: ColorPosition[]; // Координаты цветов на изображении
}

interface PaletteOptions {
  colorCount?: number;
  quality?: number;
  ignoreWhite?: boolean;
  ignoreBlack?: boolean;
}

// =====================
// Поиск координат цветов на изображении
// Алгоритм "пиковая плотность" — маркер ставится в самое плотное скопление пикселей цвета
// =====================

async function findColorPositions(
  buffer: Buffer,
  colors: string[]
): Promise<ColorPosition[]> {
  try {
    const { data, info } = await sharp(buffer)
      .resize(200, 200, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const targetRgbs = colors.map(hex => hexToRgb(hex));
    const THRESHOLD = 60;

    // Размер ячейки сетки (чем меньше — тем точнее, но медленнее)
    const GRID = 10; // сетка 10x10 пикселей на ячейку
    const gridW = Math.ceil(info.width / GRID);
    const gridH = Math.ceil(info.height / GRID);

    // Для каждого цвета — сетка плотности
    const grids = targetRgbs.map(() =>
      Array.from({ length: gridH }, () => new Float64Array(gridW))
    );

    // === Шаг 1: Назначаем каждый пиксель ближайшему цвету, копим плотность в сетке ===
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * info.channels;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        let bestIdx = -1;
        let bestDist = Infinity;

        for (let ci = 0; ci < targetRgbs.length; ci++) {
          const t = targetRgbs[ci];
          if (!t) continue;
          const dist = Math.sqrt(
            (r - t.r) ** 2 + (g - t.g) ** 2 + (b - t.b) ** 2
          );
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = ci;
          }
        }

        if (bestIdx >= 0 && bestDist < THRESHOLD) {
          const gx = Math.min(Math.floor(x / GRID), gridW - 1);
          const gy = Math.min(Math.floor(y / GRID), gridH - 1);
          // Вес: чем точнее совпадение — тем больше вклад
          grids[bestIdx][gy][gx] += 1 / (1 + bestDist);
        }
      }
    }

    // === Шаг 2: Для каждого цвета находим ячейку с максимальной плотностью ===
    const positions: ColorPosition[] = [];

    for (let ci = 0; ci < colors.length; ci++) {
      let maxDensity = 0;
      let peakGx = 0;
      let peakGy = 0;

      for (let gy = 0; gy < gridH; gy++) {
        for (let gx = 0; gx < gridW; gx++) {
          if (grids[ci][gy][gx] > maxDensity) {
            maxDensity = grids[ci][gy][gx];
            peakGx = gx;
            peakGy = gy;
          }
        }
      }

      if (maxDensity > 0) {
        // Центр найденной ячейки
        const cx = (peakGx + 0.5) * GRID;
        const cy = (peakGy + 0.5) * GRID;
        positions.push({
          hex: colors[ci],
          x: cx / info.width,
          y: cy / info.height,
        });
      } else {
        // Fallback: ближайший пиксель
        let bestDist = Infinity;
        let bestX = 0.5, bestY = 0.5;
        const t = targetRgbs[ci];
        if (t) {
          for (let y = 0; y < info.height; y += 2) {
            for (let x = 0; x < info.width; x += 2) {
              const idx = (y * info.width + x) * info.channels;
              const dist = Math.sqrt(
                (data[idx] - t.r) ** 2 +
                (data[idx + 1] - t.g) ** 2 +
                (data[idx + 2] - t.b) ** 2
              );
              if (dist < bestDist) {
                bestDist = dist;
                bestX = x / info.width;
                bestY = y / info.height;
              }
            }
          }
        }
        positions.push({ hex: colors[ci], x: bestX, y: bestY });
      }
    }

    // === Шаг 3: Разводим слишком близкие маркеры ===
    const MIN_DIST = 0.08;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[j].x - positions[i].x;
        const dy = positions[j].y - positions[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < MIN_DIST && dist > 0) {
          const scale = (MIN_DIST - dist) / 2 / dist;
          positions[i].x = Math.max(0.02, Math.min(0.98, positions[i].x - dx * scale));
          positions[i].y = Math.max(0.02, Math.min(0.98, positions[i].y - dy * scale));
          positions[j].x = Math.max(0.02, Math.min(0.98, positions[j].x + dx * scale));
          positions[j].y = Math.max(0.02, Math.min(0.98, positions[j].y + dy * scale));
        }
      }
    }

    return positions;
  } catch (error) {
    console.error('findColorPositions error:', error);
    return colors.map((hex, i) => ({
      hex,
      x: 0.2 + (i * 0.15),
      y: 0.3 + (i * 0.1),
    }));
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

// =====================
// Vibrant Palette Extraction
// =====================

async function extractColorsWithVibrant(
  buffer: Buffer,
  options: PaletteOptions = {}
): Promise<ExtractedColors> {
  const { colorCount = 5 } = options;

  // Vibrant извлекает палитру
  const Vibrant = await getVibrant();
  const palette = await Vibrant.from(buffer)
    .quality(1) // Высокое качество
    .getPalette();

  // Собираем все цвета из палитры Vibrant
  const swatchNames = [
    'Vibrant',
    'LightVibrant',
    'DarkVibrant',
    'Muted',
    'LightMuted',
    'DarkMuted',
  ] as const;

  const allColors: ColorWithMeta[] = [];
  let totalPopulation = 0;

  for (const name of swatchNames) {
    const swatch = palette[name];
    if (swatch) {
      totalPopulation += swatch.population;
    }
  }

  for (const name of swatchNames) {
    const swatch = palette[name];
    if (swatch) {
      const rgb = swatch.rgb as RGB;
      const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
      const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);

      allColors.push({
        rgb,
        hex,
        population: swatch.population,
        percentage: totalPopulation > 0 ? (swatch.population / totalPopulation) * 100 : 0,
        saturation: hsl.s,
        lightness: hsl.l,
        category: name,
      });
    }
  }

  // Гибридная сортировка: площадь (70%) + приоритет яркости (30%)
  const vibrantPriority: Record<string, number> = {
    'Vibrant': 100,
    'LightVibrant': 80,
    'DarkVibrant': 60,
    'Muted': 40,
    'LightMuted': 20,
    'DarkMuted': 10,
  };

  const maxPopulation = Math.max(...allColors.map(c => c.population));

  allColors.sort((a, b) => {
    const areaA = maxPopulation > 0 ? (a.population / maxPopulation) * 100 : 0;
    const areaB = maxPopulation > 0 ? (b.population / maxPopulation) * 100 : 0;
    const vibrancyA = vibrantPriority[a.category] || 0;
    const vibrancyB = vibrantPriority[b.category] || 0;
    const scoreA = areaA * 0.7 + vibrancyA * 0.3;
    const scoreB = areaB * 0.7 + vibrancyB * 0.3;
    return scoreB - scoreA;
  });

  // Убираем похожие цвета
  const uniqueColors: ColorWithMeta[] = [];
  for (const color of allColors) {
    const isSimilar = uniqueColors.some(
      existing => colorDistance(existing.rgb, color.rgb) < 30
    );
    if (!isSimilar) {
      uniqueColors.push(color);
    }
  }

  // =====================
  // Фильтрация "призрачных" цветов (Delta E + Saturation)
  // =====================

  // 1. Вычисляем базис: средний RGB цветов с весом > 5%
  const basisColors = uniqueColors.filter(c => c.percentage > 5);

  let filteredColors = uniqueColors;

  // Фильтруем только если есть минимум 2 цвета в базисе
  if (basisColors.length >= 2) {
    // Максимальная популяция для расчёта относительной
    const maxPop = Math.max(...uniqueColors.map(c => c.population));

    filteredColors = uniqueColors.filter(color => {
      // Относительная популяция (0-100%)
      const populationRatio = maxPop > 0 ? (color.population / maxPop) * 100 : 0;

      // Если популяция < 0.0001% от максимальной — это призрак
      if (populationRatio < 0.0001) {
        console.log(`[Phantom] ${color.hex} REMOVE (popRatio=${populationRatio.toFixed(2)}%)`);
        return false;
      }

      return true;
    });
  }

  // Берём топ-N для доминантных
  const dominantColors = filteredColors.slice(0, colorCount);

  // Пересчитываем проценты для доминантных цветов
  const dominantTotal = dominantColors.reduce((sum, c) => sum + c.population, 0);
  dominantColors.forEach(c => {
    c.percentage = dominantTotal > 0 ? (c.population / dominantTotal) * 100 : 0;
  });

  // Акцентные: оставшиеся яркие цвета с высокой насыщенностью
  const accentColors = uniqueColors
    .slice(colorCount)
    .filter(c => c.saturation > 40 && c.lightness > 20 && c.lightness < 80)
    .slice(0, 3);

  // Находим координаты цветов на изображении
  const dominantHexes = dominantColors.map(c => c.hex);
  const colorPositions = await findColorPositions(buffer, dominantHexes);

  return {
    dominant: dominantHexes,
    dominantWeights: dominantColors.map(c => Math.round(c.percentage * 10) / 10),
    accent: accentColors.map(c => c.hex),
    dominantNames: dominantColors.map(c => getName(c.hex)),
    accentNames: accentColors.map(c => getName(c.hex)),
    colorPositions,
  };
}

// =====================
// API handler
// =====================

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const searchParams = url.searchParams;

    // Параметры
    const colorCount = parseInt(searchParams.get('count') ?? '5', 10) || 5;
    const quality = parseInt(searchParams.get('quality') ?? '3', 10) || 3;
    const ignoreWhite = searchParams.get('ignoreWhite') === 'true';
    const ignoreBlack = searchParams.get('ignoreBlack') === 'true';

    const formData = await req.formData();
    const file = formData.get('file') as unknown as Blob | null;

    if (!file || typeof (file as any).arrayBuffer !== 'function') {
      return NextResponse.json(
        { error: 'Не найден файл "file" в form-data' },
        { status: 400 }
      );
    }

    const arrayBuffer = await (file as any).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await extractColorsWithVibrant(buffer, {
      colorCount,
      quality,
      ignoreWhite,
      ignoreBlack,
    });

    return NextResponse.json({
      algorithm: 'vibrant',
      colors: result.dominant,
      colorWeights: result.dominantWeights,
      colorNames: result.dominantNames,
      colorPositions: result.colorPositions,
      accentColors: result.accent,
      accentColorNames: result.accentNames,
      count: result.dominant.length,
      accentCount: result.accent.length,
    });
  } catch (e: any) {
    console.error('Vibrant palette API error:', e?.message, e?.stack);
    return NextResponse.json(
      {
        error: e?.message ?? 'Ошибка при извлечении палитры (Vibrant)',
      },
      { status: 500 }
    );
  }
}