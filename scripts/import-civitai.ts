/**
 * Импорт картинок с Civitai в WAIVA
 *
 * Использование:
 *   npx ts-node --skip-project scripts/import-civitai.ts
 *
 * Или с параметрами:
 *   npx ts-node --skip-project scripts/import-civitai.ts --limit 10 --sort "Most Reactions" --period Month
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = 'images';

// ID пользователя-импортёра (системный аккаунт)
// Замени на свой user_id из Supabase Auth
const IMPORT_USER_ID = process.env.IMPORT_USER_ID || '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env');
  process.exit(1);
}

if (!IMPORT_USER_ID) {
  console.error('Укажи IMPORT_USER_ID в .env (UUID твоего системного аккаунта)');
  process.exit(1);
}

const supabaseHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// ─── Civitai API ───

interface CivitaiImage {
  id: number;
  url: string;
  width: number;
  height: number;
  type: string;
  username: string;
  meta?: {
    prompt?: string;
    negativePrompt?: string;
    seed?: number | string;
    steps?: number;
    sampler?: string;
    cfgScale?: number;
    Model?: string;
    [key: string]: any;
  };
  baseModel?: string;
  postId?: number;
}

async function fetchCivitaiImages(limit = 5): Promise<CivitaiImage[]> {
  const params = new URLSearchParams({
    limit: String(limit + 5), // запросим чуть больше, т.к. отфильтруем видео
    sort: 'Most Reactions',
    period: 'Month',
    nsfw: 'None',
  });

  const url = `https://civitai.com/api/v1/images?${params}`;
  console.log(`\n📡 Запрос: ${url}\n`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Civitai API: ${res.status} ${res.statusText}`);

  const data = await res.json();
  const items: CivitaiImage[] = data.items ?? [];

  // Фильтруем: только изображения (не видео), с URL
  return items
    .filter(img => img.type === 'image' && img.url && !img.url.endsWith('.mp4'))
    .slice(0, limit);
}

// ─── Загрузка в Supabase Storage ───

async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function uploadToStorage(buffer: Buffer, filename: string): Promise<string> {
  const path = `${IMPORT_USER_ID}/${Date.now()}_${filename}`;

  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
    {
      method: 'POST',
      headers: {
        ...supabaseHeaders,
        'Content-Type': 'image/jpeg',
      },
      body: buffer,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Storage upload failed: ${res.status} ${text}`);
  }

  return path;
}

// ─── Извлечение цветов через sharp (локально) ───

async function extractColors(buffer: Buffer): Promise<{
  colors: string[];
  colorWeights: number[];
}> {
  try {
    const sharp = (await import('sharp')).default;

    const { data } = await sharp(buffer)
      .resize(32, 32, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Квантизация пикселей
    const colorMap = new Map<string, { r: number; g: number; b: number; count: number }>();

    for (let i = 0; i < data.length; i += 3) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const qr = Math.round(r / 16) * 16;
      const qg = Math.round(g / 16) * 16;
      const qb = Math.round(b / 16) * 16;
      const key = `${qr},${qg},${qb}`;

      const existing = colorMap.get(key);
      if (existing) {
        existing.count++;
        existing.r = Math.round((existing.r * (existing.count - 1) + r) / existing.count);
        existing.g = Math.round((existing.g * (existing.count - 1) + g) / existing.count);
        existing.b = Math.round((existing.b * (existing.count - 1) + b) / existing.count);
      } else {
        colorMap.set(key, { r, g, b, count: 1 });
      }
    }

    const sorted = Array.from(colorMap.values()).sort((a, b) => b.count - a.count);

    // Убираем похожие
    const unique: typeof sorted = [];
    for (const item of sorted) {
      const tooSimilar = unique.some(u => {
        const dr = u.r - item.r, dg = u.g - item.g, db = u.b - item.b;
        return Math.sqrt(dr * dr + dg * dg + db * db) < 50;
      });
      if (!tooSimilar) unique.push(item);
      if (unique.length >= 5) break;
    }

    const total = unique.reduce((s, c) => s + c.count, 0);
    const colors = unique.map(c => {
      const hex = '#' + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
      return hex;
    });
    const colorWeights = unique.map(c => Math.round((c.count / total) * 1000) / 10);

    return { colors, colorWeights };
  } catch (err) {
    console.error('  ⚠ Ошибка извлечения цветов:', err);
    return { colors: [], colorWeights: [] };
  }
}

// ─── Aspect ratio ───

function getAspectRatio(w: number, h: number): string {
  const ratio = w / h;
  const known = [
    { name: '1:1', value: 1 },
    { name: '4:3', value: 4 / 3 },
    { name: '3:4', value: 3 / 4 },
    { name: '16:9', value: 16 / 9 },
    { name: '9:16', value: 9 / 16 },
    { name: '3:2', value: 3 / 2 },
    { name: '2:3', value: 2 / 3 },
  ];
  let best = '1:1', bestDiff = 999;
  for (const k of known) {
    const diff = Math.abs(ratio - k.value);
    if (diff < bestDiff) { bestDiff = diff; best = k.name; }
  }
  return best;
}

// ─── Маппинг цветов в бакеты ───

const COLOR_BUCKETS: { id: string; r: number; g: number; b: number }[] = [
  { id: 'red', r: 255, g: 23, b: 68 },
  { id: 'orange', r: 255, g: 109, b: 0 },
  { id: 'yellow', r: 255, g: 234, b: 0 },
  { id: 'green', r: 0, g: 230, b: 118 },
  { id: 'teal', r: 29, g: 233, b: 182 },
  { id: 'cyan', r: 0, g: 229, b: 255 },
  { id: 'blue', r: 41, g: 121, b: 255 },
  { id: 'indigo', r: 101, g: 31, b: 255 },
  { id: 'purple', r: 213, g: 0, b: 249 },
  { id: 'pink', r: 255, g: 64, b: 129 },
  { id: 'brown', r: 141, g: 110, b: 99 },
  { id: 'black', r: 18, g: 18, b: 18 },
  { id: 'white', r: 250, g: 250, b: 250 },
];

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function mapToBucket(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  let best = 'black', bestDist = Infinity;
  for (const bucket of COLOR_BUCKETS) {
    const dist = Math.sqrt((r - bucket.r) ** 2 + (g - bucket.g) ** 2 + (b - bucket.b) ** 2);
    if (dist < bestDist) { bestDist = dist; best = bucket.id; }
  }
  return best;
}

// ─── Сохранение в БД ───

async function saveToDb(record: Record<string, any>): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/images_meta`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(record),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('  ❌ DB insert failed:', text);
    return null;
  }

  const data = await res.json();
  return data[0]?.id ?? null;
}

// ─── Main ───

async function main() {
  console.log('🚀 Импорт картинок с Civitai\n');

  const limit = parseInt(process.argv.find((_, i, arr) => arr[i - 1] === '--limit') || '5');

  const images = await fetchCivitaiImages(limit);
  console.log(`📦 Получено ${images.length} картинок\n`);

  let imported = 0, failed = 0;

  for (const img of images) {
    const idx = images.indexOf(img) + 1;
    console.log(`[${idx}/${images.length}] id=${img.id} by @${img.username} (${img.width}x${img.height})`);

    try {
      // 1. Скачиваем
      console.log('  ⬇ Скачиваем...');
      const buffer = await downloadImage(img.url);
      console.log(`  ✓ ${(buffer.length / 1024).toFixed(0)} KB`);

      // 2. Извлекаем цвета
      console.log('  🎨 Извлекаем цвета...');
      const { colors, colorWeights } = await extractColors(buffer);
      console.log(`  ✓ ${colors.length} цветов: ${colors.join(', ')}`);

      // 3. Загружаем в Storage
      console.log('  ☁ Загружаем в Storage...');
      const ext = img.url.includes('.png') ? 'png' : 'jpg';
      const path = await uploadToStorage(buffer, `civitai_${img.id}.${ext}`);
      console.log(`  ✓ ${path}`);

      // 4. Бакеты
      const buckets = colors.map(mapToBucket);

      // 5. Метаданные
      const model = img.meta?.Model || img.baseModel || null;
      const prompt = img.meta?.prompt || null;
      const seed = img.meta?.seed != null ? String(img.meta.seed) : null;

      const record = {
        user_id: IMPORT_USER_ID,
        path,
        title: null,
        prompt,
        model: model ? String(model).toLowerCase() : null,
        seed,
        source: 'civitai',
        source_author: img.username,
        source_url: `https://civitai.com/images/${img.id}`,
        colors: colors.length ? colors : null,
        color_weights: colorWeights.length ? colorWeights : null,
        aspect_ratio: getAspectRatio(img.width, img.height),
        dominant_color: buckets[0] ?? null,
        secondary_color: buckets[1] ?? null,
        third_color: buckets[2] ?? null,
        fourth_color: buckets[3] ?? null,
        fifth_color: buckets[4] ?? null,
        images_count: 1,
      };

      // 6. Сохраняем
      console.log('  💾 Сохраняем в БД...');
      const id = await saveToDb(record);

      if (id) {
        console.log(`  ✅ Импортировано! id=${id}\n`);
        imported++;
      } else {
        failed++;
      }
    } catch (err: any) {
      console.error(`  ❌ Ошибка: ${err.message}\n`);
      failed++;
    }
  }

  console.log(`\n═══════════════════════════`);
  console.log(`✅ Импортировано: ${imported}`);
  console.log(`❌ Ошибок: ${failed}`);
  console.log(`═══════════════════════════\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
