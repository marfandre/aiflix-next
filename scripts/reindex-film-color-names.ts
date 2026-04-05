// scripts/reindex-film-color-names.ts
// Скрипт для добавления NTC названий и семейств цветов к существующим видео

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import namer from 'color-namer';

function hexToFamily(hex: string): string {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return 'black';
    let r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2 * 100;
    let s = 0, h = 0;
    if (max !== min) {
        const d = max - min;
        s = (l > 50 ? d / (2 - max - min) : d / (max + min)) * 100;
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6 * 360;
        else if (max === g) h = ((b - r) / d + 2) / 6 * 360;
        else h = ((r - g) / d + 4) / 6 * 360;
    }
    if (s < 15) { if (l < 15) return 'black'; if (l > 70) return 'white'; return 'brown'; }
    if (s < 30) { if (l < 15) return 'black'; if (l < 50) return 'brown'; return 'pink'; }
    if (l < 8) return 'black';
    if (l > 95) return 'white';
    if (h >= 10 && h < 40 && l < 45 && s < 80) return 'brown';
    if (h < 15) return l > 70 ? 'pink' : 'red';
    if (h < 40) return 'orange';
    if (h < 65) return 'yellow';
    if (h < 160) return 'green';
    if (h < 185) return 'teal';
    if (h < 210) return 'cyan';
    if (h < 260) return 'blue';
    if (h < 290) return 'indigo';
    if (h < 330) return s > 40 && l > 40 ? 'pink' : 'purple';
    if (h < 346) return 'pink';
    return l > 70 || (l > 50 && s < 60) ? 'pink' : 'red';
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
