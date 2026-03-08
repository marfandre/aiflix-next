// app/api/videos/recompute-colors/route.ts
// Пересчитывает colors (5 базовых) из colors_full для всех существующих видео
// Использует max-distance greedy алгоритм для максимального разнообразия

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function hexToRgb(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [
        parseInt(h.substring(0, 2), 16),
        parseInt(h.substring(2, 4), 16),
        parseInt(h.substring(4, 6), 16),
    ];
}

function colorDist(a: string, b: string): number {
    const [r1, g1, b1] = hexToRgb(a);
    const [r2, g2, b2] = hexToRgb(b);
    return Math.sqrt((r2 - r1) ** 2 + (g2 - g1) ** 2 + (b2 - b1) ** 2);
}

function selectDiverseColors(allColors: string[], count: number): string[] {
    if (allColors.length <= count) return allColors;

    const selected = [allColors[0]];
    const remaining = allColors.slice(1);

    while (selected.length < count && remaining.length > 0) {
        let bestIdx = 0;
        let bestMinDist = -1;

        for (let i = 0; i < remaining.length; i++) {
            const minDist = Math.min(...selected.map(s => colorDist(s, remaining[i])));
            if (minDist > bestMinDist) {
                bestMinDist = minDist;
                bestIdx = i;
            }
        }

        selected.push(remaining[bestIdx]);
        remaining.splice(bestIdx, 1);
    }

    return selected;
}

export async function POST() {
    try {
        const supa = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Берём все видео с colors_full
        const { data: films, error } = await supa
            .from('films')
            .select('id, colors, colors_full, colors_preview')
            .not('colors_full', 'is', null);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!films || films.length === 0) {
            return NextResponse.json({ message: 'No films with colors_full found', updated: 0 });
        }

        let updated = 0;
        const results: { id: string; oldColors: string[]; newColors: string[] }[] = [];

        for (const film of films) {
            const fullColors: string[] = film.colors_full ?? [];
            const previewColors: string[] = film.colors_preview ?? [];
            const source = fullColors.length > 0 ? fullColors : previewColors;

            if (source.length === 0) continue;

            const newBaseColors = selectDiverseColors(source, 5);
            const oldColors = film.colors ?? [];

            // Обновляем + ставим color_mode = 'static' (раньше мог быть 'dynamic')
            const { error: updateError } = await supa
                .from('films')
                .update({
                    colors: newBaseColors,
                    color_mode: 'static',
                })
                .eq('id', film.id);

            if (!updateError) {
                updated++;
                results.push({ id: film.id, oldColors, newColors: newBaseColors });
            }
        }

        return NextResponse.json({
            message: `Updated ${updated} of ${films.length} films`,
            updated,
            total: films.length,
            results,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
    }
}
