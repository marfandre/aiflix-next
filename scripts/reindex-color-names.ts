// scripts/reindex-color-names.ts
// Скрипт для добавления NTC названий цветов к существующим картинкам

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import namer from 'color-namer';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function reindexColorNames() {
    console.log('=== Reindexing color_names for existing images ===\n');

    // 1. Получаем все картинки с colors, но без color_names
    const { data: images, error } = await supabase
        .from('images_meta')
        .select('id, colors, color_names')
        .not('colors', 'is', null);

    if (error) {
        console.error('Error fetching images:', error);
        return;
    }

    console.log(`Found ${images?.length ?? 0} images with colors\n`);

    let updated = 0;
    let skipped = 0;

    for (const img of images ?? []) {
        // Пропускаем если уже есть color_names
        if (img.color_names && img.color_names.length > 0) {
            skipped++;
            continue;
        }

        if (!img.colors || !Array.isArray(img.colors) || img.colors.length === 0) {
            skipped++;
            continue;
        }

        // Получаем NTC названия для каждого цвета
        const colorNames = img.colors.map((hex: string) => {
            try {
                const result = namer(hex);
                return result.ntc[0]?.name ?? 'Unknown';
            } catch {
                return 'Unknown';
            }
        });

        // Обновляем запись
        const { error: updateError } = await supabase
            .from('images_meta')
            .update({ color_names: colorNames })
            .eq('id', img.id);

        if (updateError) {
            console.error(`Error updating image ${img.id}:`, updateError);
        } else {
            updated++;
            console.log(`[${updated}] Image ${img.id}: ${img.colors.join(', ')} → ${colorNames.join(', ')}`);
        }
    }

    console.log(`\n=== Done! Updated: ${updated}, Skipped: ${skipped} ===`);
}

reindexColorNames();
