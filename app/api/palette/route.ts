// app/api/palette/route.ts
// Алгоритм определения цветов на основе node-vibrant
// + NTC (Name That Color) для получения человеческих названий цветов

import { NextRequest, NextResponse } from 'next/server';
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

interface ExtractedColors {
  dominant: string[];
  dominantWeights: number[];
  accent: string[];
  dominantNames: string[];
  accentNames: string[];
}

interface PaletteOptions {
  colorCount?: number;
  quality?: number;
  ignoreWhite?: boolean;
  ignoreBlack?: boolean;
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

  // Берём топ-N для доминантных
  const dominantColors = uniqueColors.slice(0, colorCount);

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

  return {
    dominant: dominantColors.map(c => c.hex),
    dominantWeights: dominantColors.map(c => Math.round(c.percentage * 10) / 10),
    accent: accentColors.map(c => c.hex),
    dominantNames: dominantColors.map(c => getName(c.hex)),
    accentNames: accentColors.map(c => getName(c.hex)),
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