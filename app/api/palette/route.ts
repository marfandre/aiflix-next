// app/api/palette/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Vibrant } from 'node-vibrant/node';
import sharp from 'sharp';

export const runtime = 'nodejs';

// =====================
// Типы
// =====================

type SwatchV4 = {
  rgb?: [number, number, number];
  r?: number;
  g?: number;
  b?: number;
  hex?: string;
  population?: number | null;
};

type RGB = [number, number, number];
type Lab = [number, number, number];

type ClusterColor = {
  hex: string;
  rgb: RGB;
  lab?: Lab;
  count: number;
};

// =====================
// Константы (упрощённый k-means)
// =====================

const SIMPLE_K = 6;               // кластеры k-means по умолчанию
const SIMPLE_MAX_SAMPLES = 5000;  // меньше пикселей
const SIMPLE_MAX_ITER = 18;       // меньше итераций
const MAX_EXTRA_COLORS = 2;       // сколько добавляем к Vibrant

// пороги для гибрида
const LAB_DISTANCE_THRESHOLD = 12; // насколько цвет должен отличаться от vibrant
const MIN_L = 10;                  // не брать почти чёрные
const MAX_L = 95;                  // не брать почти белые

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

function hexToRgb(hex: string): RGB | null {
  const m = hex.trim().replace('#', '');
  if (m.length === 3) {
    const r = parseInt(m[0] + m[0], 16);
    const g = parseInt(m[1] + m[1], 16);
    const b = parseInt(m[2] + m[2], 16);
    return [r, g, b];
  }
  if (m.length === 6) {
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return [r, g, b];
  }
  return null;
}

function uniqueByHex(colors: ClusterColor[]): ClusterColor[] {
  const seen = new Set<string>();
  const out: ClusterColor[] = [];
  for (const c of colors) {
    if (!seen.has(c.hex)) {
      seen.add(c.hex);
      out.push(c);
    }
  }
  return out;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

// =====================
// sRGB <-> Lab (только для центров, а не всех пикселей)
// =====================

function srgbToLinear(c: number): number {
  const v = c / 255;
  if (v <= 0.04045) return v / 12.92;
  return Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const v = clamp01(c);
  if (v <= 0.0031308) return 255 * (12.92 * v);
  return 255 * (1.055 * Math.pow(v, 1 / 2.4) - 0.055);
}

function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  const X = R * 0.4124 + G * 0.3576 + B * 0.1805;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = R * 0.0193 + G * 0.1192 + B * 0.9505;
  return [X, Y, Z];
}

function xyzToLab(X: number, Y: number, Z: number): Lab {
  const Xn = 0.95047;
  const Yn = 1.0;
  const Zn = 1.08883;
  let x = X / Xn;
  let y = Y / Yn;
  let z = Z / Zn;

  const epsilon = 216 / 24389;
  const kappa = 24389 / 27;

  function f(t: number): number {
    if (t > epsilon) return Math.cbrt(t);
    return (kappa * t + 16) / 116;
  }

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);
  return [L, a, b];
}

function rgbToLab(r: number, g: number, b: number): Lab {
  const [X, Y, Z] = rgbToXyz(r, g, b);
  return xyzToLab(X, Y, Z);
}

function hexToLab(hex: string): Lab | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToLab(rgb[0], rgb[1], rgb[2]);
}

function dist2Lab(a: Lab, b: Lab): number {
  const d0 = a[0] - b[0];
  const d1 = a[1] - b[1];
  const d2 = a[2] - b[2];
  return d0 * d0 + d1 * d1 + d2 * d2;
}

// =====================
// Упрощённый k-means в RGB
// =====================

interface KMeansResult {
  centers: RGB[];
  counts: number[];
}

function dist2Rgb(a: RGB, b: RGB): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function kMeansSimple(points: RGB[], k: number): KMeansResult {
  const N = points.length;
  if (N === 0) return { centers: [], counts: [] };
  const K = Math.min(k, N);

  // рандомная инициализация центров (дешевле, чем k-means++)
  const centers: RGB[] = [];
  const used = new Set<number>();
  while (centers.length < K) {
    let idx = Math.floor(Math.random() * N);
    let guard = 0;
    while (used.has(idx) && guard < 5) {
      idx = Math.floor(Math.random() * N);
      guard++;
    }
    used.add(idx);
    centers.push([...points[idx]] as RGB);
  }

  const assignments = new Array<number>(N).fill(0);

  for (let iter = 0; iter < SIMPLE_MAX_ITER; iter++) {
    let changed = false;

    // assign
    for (let i = 0; i < N; i++) {
      const p = points[i];
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let c = 0; c < K; c++) {
        const d2 = dist2Rgb(p, centers[c]);
        if (d2 < bestDist) {
          bestDist = d2;
          bestIdx = c;
        }
      }
      if (assignments[i] !== bestIdx) {
        assignments[i] = bestIdx;
        changed = true;
      }
    }

    if (!changed && iter > 0) break;

    // recompute
    const sums: RGB[] = new Array(K).fill(0).map(() => [0, 0, 0] as RGB);
    const counts = new Array<number>(K).fill(0);

    for (let i = 0; i < N; i++) {
      const cluster = assignments[i];
      const p = points[i];
      sums[cluster][0] += p[0];
      sums[cluster][1] += p[1];
      sums[cluster][2] += p[2];
      counts[cluster] += 1;
    }

    for (let c = 0; c < K; c++) {
      if (counts[c] > 0) {
        centers[c] = [
          sums[c][0] / counts[c],
          sums[c][1] / counts[c],
          sums[c][2] / counts[c],
        ];
      }
    }
  }

  const finalCounts = new Array<number>(centers.length).fill(0);
  for (const cluster of assignments) {
    finalCounts[cluster] += 1;
  }

  return { centers, counts: finalCounts };
}

async function getKMeansPalette(
  buffer: Buffer,
  options?: { k?: number; maxSamples?: number }
): Promise<ClusterColor[]> {
  const k = options?.k ?? SIMPLE_K;
  const maxSamples = options?.maxSamples ?? SIMPLE_MAX_SAMPLES;

  const image = sharp(buffer).resize(250, 250, {
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

  const totalPixels = width * height;
  const step = Math.max(1, Math.floor(totalPixels / maxSamples));
  const points: RGB[] = [];

  for (let i = 0; i < totalPixels; i += step) {
    const idx = i * channels;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    points.push([r, g, b]);
  }

  if (points.length === 0) return [];

  const { centers, counts } = kMeansSimple(points, k);

  const colors: ClusterColor[] = centers.map((center, i) => {
    const [r, g, blue] = center;
    const hex = rgbToHex(r, g, blue);
    return {
      hex,
      rgb: center,
      // lab пока не считаем — посчитаем только если нужно в гибриде
      count: counts[i] ?? 0,
    };
  });

  colors.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  return uniqueByHex(colors);
}

// =====================
// Vibrant (node) — базовые цвета
// =====================

async function getVibrantBaseColors(buffer: Buffer): Promise<ClusterColor[]> {
  const palette = await Vibrant.from(buffer)
    .maxColorCount(128)
    .quality(1)
    .getPalette();

  if (!palette) return [];

  const preferOrder = ['Vibrant', 'DarkVibrant', 'LightVibrant'] as const;
  const result: ClusterColor[] = [];

  for (const name of preferOrder) {
    const swatch = palette[name] as SwatchV4 | undefined;
    if (!swatch) continue;

    let hex = swatch.hex;
    if (!hex) {
      const rgb =
        swatch.rgb ??
        (typeof swatch.r === 'number' &&
          typeof swatch.g === 'number' &&
          typeof swatch.b === 'number'
          ? [swatch.r, swatch.g, swatch.b]
          : null);
      if (!rgb) continue;
      hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
    }

    const rgb = hexToRgb(hex);
    if (!rgb) continue;

    result.push({
      hex,
      rgb,
      count: swatch.population ?? 0,
    });
  }

  // Убираем дубликаты и сортируем по доминантности (population)
  const unique = uniqueByHex(result);
  unique.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

  return unique;
}


// =====================
// Hybrid: Vibrant + упрощённый k-means
// =====================

async function getHybridPalette(
  buffer: Buffer,
  k: number
): Promise<string[]> {
  const vibrantBase = await getVibrantBaseColors(buffer);
  const kmeansColors = await getKMeansPalette(buffer, { k });

  // посчитаем Lab для всех центров 1 раз
  for (const c of vibrantBase) {
    if (!c.lab) c.lab = rgbToLab(c.rgb[0], c.rgb[1], c.rgb[2]);
  }
  for (const c of kmeansColors) {
    if (!c.lab) c.lab = rgbToLab(c.rgb[0], c.rgb[1], c.rgb[2]);
  }

  // текущая палитра (для проверки "похожести")
  const palette: ClusterColor[] = [...vibrantBase];
  const extras: ClusterColor[] = [];

  for (const c of kmeansColors) {
    if (extras.length >= MAX_EXTRA_COLORS) break;
    if (!c.lab) continue;

    // уже есть такой hex?
    if (palette.some((p) => p.hex === c.hex)) continue;

    const L = c.lab[0];
    if (L < MIN_L || L > MAX_L) continue; // слишком чёрный/белый

    // расстояние до ближайшего цвета во всей палитре (vibrant + extras)
    let minD2 = Infinity;
    for (const p of palette) {
      if (!p.lab) continue;
      const d2 = dist2Lab(c.lab, p.lab);
      if (d2 < minD2) minD2 = d2;
    }
    const dist = Math.sqrt(minD2);

    // если слишком похож — не берём
    if (dist < LAB_DISTANCE_THRESHOLD) continue;

    extras.push(c);
    palette.push(c); // чтобы следующие кандидаты тоже с ним сравнивались
  }

  // Объединяем vibrant и дополнительные цвета, убираем дубли
  const merged = uniqueByHex(palette);

  // Сортируем по доминантности (count) — самый важный цвет первым
  merged.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

  const finalColors = merged.map((c) => c.hex);
  return finalColors;
}



// =====================
// API handler
// =====================

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const searchParams = url.searchParams;

    const mode = (searchParams.get('mode') ?? 'hybrid').toLowerCase();
    const kParam = parseInt(searchParams.get('k') ?? '', 10);
    const k = Number.isFinite(kParam) && kParam > 0 ? kParam : SIMPLE_K;

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

    let colors: string[] = [];

    if (mode === 'vibrant') {
      const base = await getVibrantBaseColors(buffer);
      colors = base.map((c) => c.hex);
    } else if (mode === 'kmeans') {
      const km = await getKMeansPalette(buffer, { k });
      colors = km.map((c) => c.hex);
    } else {
      // hybrid по умолчанию
      colors = await getHybridPalette(buffer, k);
    }

    return NextResponse.json({ mode, colors });
  } catch (e: any) {
    console.error('Simplified palette API error:', e?.message, e?.stack);
    return NextResponse.json(
      {
        error:
          e?.message ??
          'Ошибка при извлечении палитры (упрощённый k-means + Vibrant)',
      },
      { status: 500 }
    );
  }
}
