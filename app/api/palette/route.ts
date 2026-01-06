// app/api/palette/route.ts
// Улучшенный алгоритм определения цветов на основе MMCQ (Modified Median Cut Quantization)
// + NTC (Name That Color) для получения человеческих названий цветов

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
// MMCQ Palette Extraction
// =====================

interface PaletteOptions {
  colorCount?: number;      // Количество цветов (по умолчанию 5)
  quality?: number;         // 1 = каждый пиксель, 10 = каждый 10-й (по умолчанию 5)
  ignoreWhite?: boolean;    // Игнорировать белый (по умолчанию false)
  ignoreBlack?: boolean;    // Игнорировать чёрный (по умолчанию false)
}

async function getMMCQPalette(
  buffer: Buffer,
  options: PaletteOptions = {}
): Promise<string[]> {
  const {
    colorCount = 5,
    quality = 5,
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

  // Собираем пиксели
  const pixels: RGB[] = [];
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
  }

  if (pixels.length === 0) {
    return [];
  }

  // Запускаем MMCQ
  const quantize = await getQuantize();

  // Запрашиваем больше цветов чтобы потом отфильтровать похожие
  const result = quantize(pixels, colorCount * 2);

  if (!result) {
    return [];
  }

  const palette = result.palette();

  if (!palette || palette.length === 0) {
    return [];
  }

  // Убираем слишком похожие цвета
  const uniqueColors = removeSimilarColors(palette, 30);

  // Берём нужное количество
  const finalColors = uniqueColors.slice(0, colorCount);

  // Конвертируем в HEX
  return finalColors.map(([r, g, b]) => rgbToHex(r, g, b));
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
    const quality = parseInt(searchParams.get('quality') ?? '5', 10) || 5;
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

    const colors = await getMMCQPalette(buffer, {
      colorCount,
      quality,
      ignoreWhite,
      ignoreBlack,
    });

    // Получаем NTC названия для каждого цвета
    const colorNames = colors.map((hex) => {
      try {
        const result = namer(hex);
        return result.ntc[0]?.name ?? 'Unknown';
      } catch {
        return 'Unknown';
      }
    });

    return NextResponse.json({
      algorithm: 'mmcq',
      colors,
      colorNames,  // NTC названия для поиска по категориям
      count: colors.length,
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
