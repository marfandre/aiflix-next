// scripts/reindex-positions.ts
// Пересчёт позиций цветовых маркеров для всех картинок
// Использование: npx tsx scripts/reindex-positions.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { findColorPositions } from '../lib/color-positions';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    const { data: images, error } = await supabase
        .from('images_meta')
        .select('id, path, colors')
        .not('colors', 'is', null)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Fetch error:', error);
        return;
    }

    console.log(`Found ${images.length} images with colors. Reindexing positions...\n`);

    let updated = 0;
    let errors = 0;

    for (const img of images) {
        try {
            const { data: urlData } = supabase.storage
                .from('images')
                .getPublicUrl(img.path);

            const res = await fetch(urlData.publicUrl);
            if (!res.ok) {
                console.error(`  [SKIP] ${img.id} — fetch ${res.status}`);
                errors++;
                continue;
            }

            const buffer = Buffer.from(await res.arrayBuffer());
            const positions = await findColorPositions(buffer, img.colors);

            const { error: updateError } = await supabase
                .from('images_meta')
                .update({ color_positions: positions })
                .eq('id', img.id);

            if (updateError) {
                console.error(`  [ERR] ${img.id}:`, updateError.message);
                errors++;
            } else {
                updated++;
                process.stdout.write(`\r  Updated: ${updated}/${images.length} (errors: ${errors})`);
            }
        } catch (e: any) {
            console.error(`  [ERR] ${img.id}:`, e.message);
            errors++;
        }
    }

    console.log(`\n\nDone! Updated: ${updated}, Errors: ${errors}`);
}

main();
