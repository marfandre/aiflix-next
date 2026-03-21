// scripts/reindex-film-color-names.ts
// Скрипт для добавления NTC названий и семейств цветов к существующим видео

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import namer from 'color-namer';

const FAMILY_BASES = [
    { id: 'red', r: 255, g: 23, b: 68 }, { id: 'orange', r: 255, g: 109, b: 0 },
    { id: 'yellow', r: 255, g: 234, b: 0 }, { id: 'green', r: 0, g: 230, b: 118 },
    { id: 'teal', r: 29, g: 233, b: 182 }, { id: 'cyan', r: 0, g: 229, b: 255 },
    { id: 'blue', r: 41, g: 121, b: 255 }, { id: 'indigo', r: 101, g: 31, b: 255 },
    { id: 'purple', r: 213, g: 0, b: 249 }, { id: 'pink', r: 255, g: 64, b: 129 },
    { id: 'brown', r: 141, g: 110, b: 99 }, { id: 'black', r: 18, g: 18, b: 18 },
    { id: 'white', r: 250, g: 250, b: 250 },
];

function hexToFamily(hex: string): string {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return 'black';
    const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    let bestId = 'black', bestDist = Infinity;
    for (const f of FAMILY_BASES) {
        const d = (r - f.r) ** 2 + (g - f.g) ** 2 + (b - f.b) ** 2;
        if (d < bestDist) { bestDist = d; bestId = f.id; }
    }
    return bestId;
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function reindexFilmColorNames() {
    console.log('=== Reindexing color_names + color_families for existing films ===\n');

    const { data: films, error } = await supabase
        .from('films')
        .select('id, colors, color_names, color_families')
        .not('colors', 'is', null);

    if (error) {
        console.error('Error fetching films:', error);
        return;
    }

    console.log(`Found ${films?.length ?? 0} films with colors\n`);

    let updated = 0;
    let skipped = 0;

    for (const film of films ?? []) {
        const hasNames = film.color_names && film.color_names.length > 0;
        const hasFamilies = film.color_families && film.color_families.length > 0;

        if (hasNames && hasFamilies) {
            skipped++;
            continue;
        }

        if (!film.colors || !Array.isArray(film.colors) || film.colors.length === 0) {
            skipped++;
            continue;
        }

        const updateData: Record<string, any> = {};

        if (!hasNames) {
            updateData.color_names = film.colors.map((hex: string) => {
                try {
                    const result = namer(hex);
                    return result.ntc[0]?.name ?? 'Unknown';
                } catch {
                    return 'Unknown';
                }
            });
        }

        if (!hasFamilies) {
            updateData.color_families = film.colors.map((hex: string) => hexToFamily(hex));
        }

        const { error: updateError } = await supabase
            .from('films')
            .update(updateData)
            .eq('id', film.id);

        if (updateError) {
            console.error(`Error updating film ${film.id}:`, updateError);
        } else {
            updated++;
            const families = updateData.color_families ?? film.color_families;
            console.log(`[${updated}] Film ${film.id}: families=${families?.join(', ')}`);
        }
    }

    console.log(`\n=== Done! Updated: ${updated}, Skipped: ${skipped} ===`);
}

reindexFilmColorNames();
