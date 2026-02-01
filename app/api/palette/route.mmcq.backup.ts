// app/api/palette/route.ts
// Улучшенный алгоритм определения цветов на основе MMCQ (Modified Median Cut Quantization)
// + NTC (Name That Color) для получения человеческих названий цветов
// + Акцентные цвета (яркие цвета с малой площадью)

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import namer from 'color-namer';

export const runtime = 'nodejs';

// Типы для quantize
type RGB = [number, number, number];
type QuantizeResult = {
  palette: () => RGB[];
};

// Динамический импорт quantize (CommonJS модуль)
let quantizeLib: ((pixels: RGB[], maxColors: number) => QuantizeResult | null) | null = null;

async function getQuantize() {
  if (!quantizeLib) {
    const mod = await import('quantize');
    quantizeLib = (mod.default || mod) as typeof quantizeLib;
  }
  return quantizeLib!;
}

// =====================
// Утилиты
// =====================

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const rr = clamp(r).toString(16).padStart(2, '0');
  const gg = clamp(g).toString(16).padStart(2, '0');
  const bb = clamp(b).toString(16).padStart(2, '0');
  return `#${rr}${gg}${bb}`.toUpperCase();
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

// Расстояние между цветами в RGB (для дедупликации)
function colorDistance(a: RGB, b: RGB): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Убрать слишком похожие цвета
function removeSimilarColors(colors: RGB[], threshold: number = 25): RGB[] {
  const result: RGB[] = [];

  for (const color of colors) {
    const isSimilar = result.some(existing => colorDistance(existing, color) < threshold);
    if (!isSimilar) {
      result.push(color);
    }
  }

  return result;
}

// =====================
// Тип для цвета с метаданными
// =====================

interface ColorWithMeta {
  rgb: RGB;
  hex: string;
  count: number;       // Количество пикселей
  percentage: number;  // Процент от общей площади
  saturation: number;  // Насыщенность (0-100)
  lightness: number;   // Яркость (0-100)
}

// =====================
// MMCQ Palette Extraction с подсчётом площади
// =====================

interface PaletteOptions {
  colorCount?: number;
  quality?: number;
  ignoreWhite?: boolean;
  ignoreBlack?: boolean;
}

interface ExtractedColors {
  dominant: string[];      // Основные цвета (по площади)
  dominantWeights: number[]; // Веса (процент площади)
  accent: string[];        // Акцентные цвета (яркие, но малая площадь)
  dominantNames: string[]; // NTC названия основных
  accentNames: string[];   // NTC названия акцентных
}

async function extractColorsWithAccents(
  buffer: Buffer,
  options: PaletteOptions = {}
): Promise<ExtractedColors> {
  const {
    colorCount = 5,
    quality = 3,
    ignoreWhite = false,
    ignoreBlack = false,
  } = options;

  // Resize для скорости
  const image = sharp(buffer).resize(300, 300, {
    fit: 'inside',
    withoutEnlargement: true,
  });

  const { data, info } = await image
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const channels = info.channels;

  if (channels < 3) {
    throw new Error('Ожидается как минимум 3 канала (RGB)');
  }

  // Собираем все пиксели для подсчёта
  const pixels: RGB[] = [];
  const colorCounts = new Map<string, { rgb: RGB; count: number }>();
  const totalPixels = width * height;

  for (let i = 0; i < totalPixels; i += quality) {
    const idx = i * channels;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    // Фильтруем белый/чёрный если нужно
    if (ignoreWhite && r > 250 && g > 250 && b > 250) continue;
    if (ignoreBlack && r < 5 && g < 5 && b < 5) continue;

    pixels.push([r, g, b]);

    // Округляем для группировки (упрощённый подсчёт)
    const key = `${Math.round(r / 10) * 10},${Math.round(g / 10) * 10},${Math.round(b / 10) * 10}`;
    const existing = colorCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorCounts.set(key, { rgb: [r, g, b], count: 1 });
    }
  }

  if (pixels.length === 0) {
    return { dominant: [], dominantWeights: [], accent: [], dominantNames: [], accentNames: [] };
  }

  const sampledPixels = pixels.length;

  // Запускаем MMCQ для получения палитры
  const quantize = await getQuantize();
  const result = quantize(pixels, 20); // Берём больше для анализа

  if (!result) {
    return { dominant: [], dominantWeights: [], accent: [], dominantNames: [], accentNames: [] };
  }

  const palette = result.palette();

  if (!palette || palette.length === 0) {
    return { dominant: [], dominantWeights: [], accent: [], dominantNames: [], accentNames: [] };
  }

  // Подсчитываем метаданные для каждого цвета палитры
  const colorsWithMeta: ColorWithMeta[] = palette.map(rgb => {
    // Считаем приблизительную площадь этого цвета
    let count = 0;
    const threshold = 40; // Расстояние для считания похожими

    for (const [, data] of colorCounts) {
      if (colorDistance(rgb, data.rgb) < threshold) {
        count += data.count;
      }
    }

    const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);

    return {
      rgb,
      hex: rgbToHex(rgb[0], rgb[1], rgb[2]),
      count,
      percentage: (count / sampledPixels) * 100,
      saturation: hsl.s,
      lightness: hsl.l,
    };
  });

  // Сортируем по площади с насыщенность-бустом (яркие цвета важнее!)
  // Насыщенные цвета получают буст до +50% к весу
  const SATURATION_BOOST = 0.5; // Коэффициент буста (0.5 = +50% максимум)

  const byBoostedArea = [...colorsWithMeta]
    .map(c => {
      // Нормализуем насыщенность (0-1)
      const satNormalized = c.saturation / 100;
      // Буст больше для средней-высокой яркости (30-80%), меньше для слишком тёмных/светлых
      const lightnessMultiplier = c.lightness > 20 && c.lightness < 85 ? 1 : 0.3;
      // Итоговый буст
      const boost = 1 + (satNormalized * SATURATION_BOOST * lightnessMultiplier);
      const boostedScore = c.percentage * boost;
      return { ...c, boostedScore };
    })
    .sort((a, b) => b.boostedScore - a.boostedScore);

  // Доминантные: топ по бустированной площади, убираем похожие
  const dominantColors: ColorWithMeta[] = [];
  for (const color of byBoostedArea) {
    if (dominantColors.length >= colorCount) break;
    const isSimilar = dominantColors.some(
      existing => colorDistance(existing.rgb, color.rgb) < 30
    );
    if (!isSimilar) {
      dominantColors.push(color);
    }
  }

  // ГАРАНТИРОВАННЫЙ СЛОТ: если нет насыщенного цвета — добавляем!
  const MIN_SATURATION_FOR_VIBRANT = 50; // Минимум 50% насыщенности
  const hasVibrantColor = dominantColors.some(c => c.saturation > MIN_SATURATION_FOR_VIBRANT);

  if (!hasVibrantColor && dominantColors.length >= colorCount) {
    // Ищем самый насыщенный цвет, который ещё не в палитре
    const mostSaturated = colorsWithMeta
      .filter(c =>
        c.saturation > MIN_SATURATION_FOR_VIBRANT &&
        c.lightness > 20 && c.lightness < 85 && // Не слишком тёмный/светлый
        c.percentage > 3 && // Минимум 3% площади — иначе цвет незаметен // Хотя бы 1% площади
        !dominantColors.some(d => colorDistance(d.rgb, c.rgb) < 30)
      )
      .sort((a, b) => b.saturation - a.saturation)[0];

    if (mostSaturated) {
      // Заменяем последний (наименее важный) слот
      dominantColors[dominantColors.length - 1] = mostSaturated;
    }
  }

  // Вычисляем среднюю яркость доминантных цветов для контраста
  const avgDominantLightness = dominantColors.length > 0
    ? dominantColors.reduce((sum, c) => sum + c.lightness, 0) / dominantColors.length
    : 50;

  // Акцентные: яркие свечения, насыщенные малые элементы, контрастные
  const accentColors: ColorWithMeta[] = [];
  const accentCandidates = colorsWithMeta
    .filter(c => {
      // Малая площадь (<25% - увеличили порог для мелких деталей)
      const isSmallArea = c.percentage < 25;
      if (!isSmallArea) return false;

      // Высокая яркость (свечение типа солнца, неона) - lightness > 60%
      const isGlowing = c.lightness > 60 && c.lightness < 98;

      // Насыщенность (>25% - понизили порог для голубого/оранжевого)
      const isSaturated = c.saturation > 25;

      // Контраст с фоном (разница яркости > 20%)
      const hasContrast = Math.abs(c.lightness - avgDominantLightness) > 20;

      // Не слишком тёмный (lightness > 12)
      const notTooDark = c.lightness > 12;

      // Любой из критериев: свечение ИЛИ насыщенность ИЛИ контраст
      return (isGlowing || isSaturated || hasContrast) && notTooDark;
    })
    .map(c => {
      // Вычисляем "акцентный скор" - приоритет насыщенным ярким цветам
      const contrastBonus = Math.abs(c.lightness - avgDominantLightness);
      const glowBonus = c.lightness > 60 ? (c.lightness - 60) * 1.5 : 0;
      const saturationBonus = c.saturation > 30 ? c.saturation * 1.2 : c.saturation;
      const score = saturationBonus + contrastBonus + glowBonus;
      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score); // Сортируем по комбинированному скору

  for (const color of accentCandidates) {
    if (accentColors.length >= 3) break;

    // Не должен быть похож на доминантные
    const similarToDominant = dominantColors.some(
      d => colorDistance(d.rgb, color.rgb) < 50
    );
    // Не должен быть похож на уже добавленные акцентные
    const similarToAccent = accentColors.some(
      a => colorDistance(a.rgb, color.rgb) < 40
    );

    if (!similarToDominant && !similarToAccent) {
      accentColors.push(color);
    }
  }

  // Получаем NTC названия
  const getName = (hex: string): string => {
    try {
      const result = namer(hex);
      return result.ntc[0]?.name ?? 'Unknown';
    } catch {
      return 'Unknown';
    }
  };

  return {
    dominant: dominantColors.map(c => c.hex),
    dominantWeights: dominantColors.map(c => Math.round(c.percentage * 10) / 10), // Округляем до 0.1%
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

    const result = await extractColorsWithAccents(buffer, {
      colorCount,
      quality,
      ignoreWhite,
      ignoreBlack,
    });

    return NextResponse.json({
      algorithm: 'mmcq-accent',
      colors: result.dominant,
      colorWeights: result.dominantWeights, // Веса цветов (процент площади)
      colorNames: result.dominantNames,
      accentColors: result.accent,
      accentColorNames: result.accentNames,
      count: result.dominant.length,
      accentCount: result.accent.length,
    });
  } catch (e: any) {
    console.error('MMCQ palette API error:', e?.message, e?.stack);
    return NextResponse.json(
      {
        error: e?.message ?? 'Ошибка при извлечении палитры (MMCQ)',
      },
      { status: 500 }
    );
  }
}