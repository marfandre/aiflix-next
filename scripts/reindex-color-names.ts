// scripts/reindex-color-names.ts
// Скрипт для добавления NTC названий и семейств цветов к существующим картинкам

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import namer from 'color-namer';
import { hexToFamily, hexToFamilyWeights } from '../lib/color-utils';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function reindexColorNames() {
    console.log('=== Reindexing color_names + color_families for existing images ===\n');

    const { data: images, error } = await supabase
        .from('images_meta')
        .select('id, colors, color_names, color_families')
        .not('colors', 'is', null);

    if (error) {
        console.error('Error fetching images:', error);
        return;
    }

    console.log(`Found ${images?.length ?? 0} images with colors\n`);

    let updated = 0;
    let skipped = 0;

    for (const img of images ?? []) {
        const hasNames = img.color_names && img.color_names.length > 0;
        const hasFamilies = img.color_families && img.color_families.length > 0;

        if (!img.colors || !Array.isArray(img.colors) || img.colors.length === 0) {
            skipped++;
            continue;
        }

        const updateData: Record<string, any> = {};

        // Всегда пересчитываем families (обновлённая логика hexToFamily)
        updateData.color_families = img.colors.map((hex: string) => hexToFamily(hex));
        updateData.color_family_weights = img.colors.map((hex: string) => hexToFamilyWeights(hex));

        if (!hasNames) {
            updateData.color_names = img.colors.map((hex: string) => {
                try {
                    const result = namer(hex);
                    return result.ntc[0]?.name ?? 'Unknown';
                } catch {
                    return 'Unknown';
                }
            });
        }

        const { error: updateError } = await supabase
            .from('images_meta')
            .update(updateData)
            .eq('id', img.id);

        if (updateError) {
            console.error(`Error updating image ${img.id}:`, updateError);
        } else {
            updated++;
            const families = updateData.color_families ?? img.color_families;
            console.log(`[${updated}] Image ${img.id}: families=${families?.join(', ')}`);
        }
    }

    console.log(`\n=== Done! Updated: ${updated}, Skipped: ${skipped} ===`);
}

reindexColorNames();
