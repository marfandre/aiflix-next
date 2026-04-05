// scripts/reindex-color-weights.ts
// Пересчёт color_weights для картинок у которых их нет
// Скачивает изображение из Supabase Storage, анализирует пиксели через node-vibrant

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// Динамический импорт node-vibrant
const getVibrant = async () => {
    const mod = await import('node-vibrant/node');
    return mod.Vibrant;
};

type RGB = [number, number, number];

function rgbToHex(r: number, g: number, b: number): string {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`.toUpperCase();
}

function colorDistance(a: RGB, b: RGB): number {
    return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

async function extractWeights(buffer: Buffer): Promise<{ hex: string; weight: number }[]> {
    const Vibrant = await getVibrant();
    const palette = await Vibrant.from(buffer).quality(1).getPalette();

    const swatchNames = ['Vibrant', 'LightVibrant', 'DarkVibrant', 'Muted', 'LightMuted', 'DarkMuted'] as const;

    let totalPopulation = 0;
    const allColors: { rgb: RGB; hex: string; population: number }[] = [];

    for (const name of swatchNames) {
        const swatch = palette[name];
        if (swatch) totalPopulation += swatch.population;
    }

    for (const name of swatchNames) {
        const swatch = palette[name];
        if (swatch) {
            const rgb = swatch.rgb as RGB;
            allColors.push({
                rgb,
                hex: rgbToHex(rgb[0], rgb[1], rgb[2]),
                population: swatch.population,
            });
        }
    }

    // Сортируем по площади
    allColors.sort((a, b) => b.population - a.population);

    // Убираем похожие
    const unique: typeof allColors = [];
    for (const c of allColors) {
        if (!unique.some(u => colorDistance(u.rgb, c.rgb) < 30)) {
            unique.push(c);
        }
    }

    const top = unique.slice(0, 5);
    const topTotal = top.reduce((s, c) => s + c.population, 0);

    return top.map(c => ({
        hex: c.hex,
        weight: topTotal > 0 ? Math.round((c.population / topTotal) * 1000) / 10 : 0,
    }));
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LIMIT = parseInt(process.argv[2] ?? '10', 10);

async function main() {
    console.log(`=== Reindexing color_weights for last ${LIMIT} images without weights ===\n`);

    const { data: images, error } = await supabase
        .from('images_meta')
        .select('id, path, colors, color_weights')
        .is('color_weights', null)
        .not('path', 'is', null)
        .order('created_at', { ascending: false })
        .limit(LIMIT);

    if (error) {
        console.error('Fetch error:', error);
        return;
    }

    console.log(`Found ${images?.length ?? 0} images to process\n`);

    let updated = 0;
    let failed = 0;

    for (const img of images ?? []) {
        try {
            // Скачиваем изображение из Storage
            const { data: fileData, error: dlError } = await supabase.storage
                .from('images')
                .download(img.path);

            if (dlError || !fileData) {
                console.error(`  [SKIP] ${img.id}: download error:`, dlError?.message);
                failed++;
                continue;
            }

            const buffer = Buffer.from(await fileData.arrayBuffer());

            // Resize для скорости
            const resized = await sharp(buffer)
                .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
                .toBuffer();

            const weights = await extractWeights(resized);

            // Маппим веса на существующие colors (по порядку)
            // colors в БД уже отсортированы по доминантности
            const colorWeights = (img.colors ?? []).map((_: string, i: number) => {
                return weights[i]?.weight ?? 0;
            });

            const { error: upError } = await supabase
                .from('images_meta')
                .update({ color_weights: colorWeights })
                .eq('id', img.id);

            if (upError) {
                console.error(`  [ERR] ${img.id}:`, upError.message);
                failed++;
            } else {
                updated++;
                console.log(`  [${updated}] ${img.id}: weights=[${colorWeights.join(', ')}]`);
            }
        } catch (err: any) {
            console.error(`  [ERR] ${img.id}:`, err?.message);
            failed++;
        }
    }

    console.log(`\n=== Done! Updated: ${updated}, Failed: ${failed} ===`);
}

main();
