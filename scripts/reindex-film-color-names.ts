// scripts/reindex-film-color-names.ts
// Скрипт для добавления NTC названий цветов к существующим видео

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import namer from 'color-namer';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function reindexFilmColorNames() {
    console.log('=== Reindexing color_names for existing films ===\n');

    const { data: films, error } = await supabase
        .from('films')
        .select('id, colors, color_names')
        .not('colors', 'is', null);

    if (error) {
        console.error('Error fetching films:', error);
        return;
    }

    console.log(`Found ${films?.length ?? 0} films with colors\n`);

    let updated = 0;
    let skipped = 0;

    for (const film of films ?? []) {
        if (film.color_names && film.color_names.length > 0) {
            skipped++;
            continue;
        }

        if (!film.colors || !Array.isArray(film.colors) || film.colors.length === 0) {
            skipped++;
            continue;
        }

        const colorNames = film.colors.map((hex: string) => {
            try {
                const result = namer(hex);
                return result.ntc[0]?.name ?? 'Unknown';
            } catch {
                return 'Unknown';
            }
        });

        const { error: updateError } = await supabase
            .from('films')
            .update({ color_names: colorNames })
            .eq('id', film.id);

        if (updateError) {
            console.error(`Error updating film ${film.id}:`, updateError);
        } else {
            updated++;
            console.log(`[${updated}] Film ${film.id}: ${film.colors.join(', ')} → ${colorNames.join(', ')}`);
        }
    }

    console.log(`\n=== Done! Updated: ${updated}, Skipped: ${skipped} ===`);
}

reindexFilmColorNames();
