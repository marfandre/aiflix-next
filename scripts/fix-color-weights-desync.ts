// One-shot: fixes images where colors.length !== color_weights.length.
// Truncates/normalizes color_weights to align with current colors array.
// Run: npx tsx scripts/fix-color-weights-desync.ts [--apply]

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APPLY = process.argv.includes('--apply');

async function main() {
  const { data, error } = await supa
    .from('images_meta')
    .select('id, path, colors, color_weights')
    .not('colors', 'is', null);

  if (error || !data) {
    console.error('Fetch failed:', error);
    return;
  }

  const desynced = data.filter((img: any) => {
    const c = img.colors ?? [];
    const w = img.color_weights ?? [];
    return Array.isArray(c) && Array.isArray(w) && c.length !== w.length;
  });

  console.log(`Total images: ${data.length}`);
  console.log(`Desynced (colors.length !== color_weights.length): ${desynced.length}`);
  console.log(`Mode: ${APPLY ? 'APPLY (will update DB)' : 'DRY RUN (use --apply to write)'}\n`);

  let fixed = 0;
  let errors = 0;

  for (const img of desynced as any[]) {
    const colors: string[] = img.colors;
    const oldWeights: number[] = img.color_weights ?? [];

    // Heuristic: assume the existing weights[i] correspond positionally to old
    // colors[i]. Since we don't have the old colors array stored separately,
    // we treat surviving colors as the first N entries and reuse their weights.
    // This matches the most common edit pattern (trailing removal).
    const matched: number[] = colors.map((_, i) =>
      oldWeights[i] != null ? oldWeights[i] : NaN
    );
    const knownLeftover = oldWeights.slice(colors.length);
    const fallback = knownLeftover.length
      ? knownLeftover.reduce((a, b) => a + b, 0) / knownLeftover.length
      : 100 / colors.length;

    const filled = matched.map((w) => (Number.isNaN(w) ? fallback : w));
    const sum = filled.reduce((a, b) => a + b, 0);
    const newWeights = sum > 0
      ? filled.map((w) => Math.round((w / sum) * 1000) / 10)
      : colors.map(() => Math.round((100 / colors.length) * 10) / 10);

    const fname = img.path?.split('/').pop() ?? img.id;
    console.log(
      `[${img.id}] ${fname}\n  colors(${colors.length})  old_w(${oldWeights.length})=${JSON.stringify(oldWeights)}  →  new_w=${JSON.stringify(newWeights)}`
    );

    if (APPLY) {
      const { error: upErr } = await supa
        .from('images_meta')
        .update({ color_weights: newWeights })
        .eq('id', img.id);
      if (upErr) {
        console.error(`  ! update failed: ${upErr.message}`);
        errors++;
      } else {
        fixed++;
      }
    }
  }

  console.log(
    `\nDone. ${APPLY ? `Fixed: ${fixed}, errors: ${errors}` : 'Dry run — re-run with --apply to write.'}`
  );
}

main();
