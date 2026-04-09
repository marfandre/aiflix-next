// Mimics ImageFeedClient ranking for pink search and prints top results
// with their color hex / weights / family probabilities so we can see WHY
// red-looking or purple-looking images end up in the pink list.

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TARGET = 'pink';
const POSITION_WEIGHT = [35, 25, 20, 12, 8];
const MIN_WEIGHT = 3;

// Specific image IDs the user complained about — always print their breakdown.
const INSPECT_IDS = new Set<string>([
  'dd03d932-4ee0-4bff-9f63-5fbb6b6083d4',
  'a0e7d7db-0888-4510-af54-5185c73a2da9',
]);

function scoreImage(img: any) {
  const families: string[] = img.color_families ?? [];
  const weights: number[] | null = img.color_weights ?? null;
  const familyWeights: Array<Record<string, number>> | null = img.color_family_weights ?? null;
  const colors: string[] = img.colors ?? [];

  // Sums per family across all slots — for dominance checks.
  const totals: Record<string, number> = {};
  let pinkScore = 0;
  const breakdown: string[] = [];

  const n = Math.max(families.length, familyWeights?.length ?? 0);
  for (let i = 0; i < n && i < 5; i++) {
    const pixelWeight = weights?.[i] ?? POSITION_WEIGHT[i] ?? 5;
    if (!familyWeights || !familyWeights[i]) continue;
    const fw = familyWeights[i];
    for (const [fam, prob] of Object.entries(fw)) {
      totals[fam] = (totals[fam] ?? 0) + pixelWeight * prob;
    }
    const pinkProb = fw[TARGET] ?? 0;
    const contribution = pixelWeight * pinkProb;
    pinkScore += contribution;
    const fwStr = Object.entries(fw)
      .map(([k, v]) => `${k}=${(v * 100).toFixed(0)}`)
      .join(',');
    const topEntry = Object.entries(fw).reduce((a, b) => (b[1] > a[1] ? b : a));
    breakdown.push(
      `  [${i}] ${colors[i]} w=${pixelWeight}% top1=${topEntry[0]}(${(topEntry[1] * 100).toFixed(0)}%) pink=${(pinkProb * 100).toFixed(0)}% → +${contribution.toFixed(1)}  | ${fwStr}`
    );
  }

  return { score: pinkScore, totals, breakdown };
}

async function main() {
  const { data, error } = await supabase
    .from('images_meta')
    .select('id, path, colors, color_weights, color_families, color_family_weights')
    .not('color_family_weights', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error(error);
    return;
  }

  // Apply the same SQL prefilter the app uses: pink must be in color_families.
  const prefiltered = (data ?? []).filter((img: any) =>
    Array.isArray(img.color_families) && img.color_families.includes(TARGET)
  );

  const scored = prefiltered.map((img: any) => {
    const { score, totals, breakdown } = scoreImage(img);
    return { id: img.id, path: img.path, score, totals, breakdown };
  });

  scored.sort((a, b) => b.score - a.score);
  const filtered = scored.filter(s => s.score >= MIN_WEIGHT);

  console.log(`\n=== "${TARGET}" candidates (after SQL prefilter), MIN_WEIGHT=${MIN_WEIGHT} ===`);
  console.log(`Prefiltered: ${prefiltered.length}, above MIN_WEIGHT: ${filtered.length}\n`);

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL + '/storage/v1/object/public/images/';
  for (const s of filtered.slice(0, 50)) {
    const totalsStr = Object.entries(s.totals)
      .filter(([, v]) => v >= 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => `${k}=${v.toFixed(1)}`)
      .join(' ');
    console.log(
      `score=${s.score.toFixed(1).padStart(5)}  totals: ${totalsStr}  ${baseUrl}${s.path}`
    );
  }

  // Detailed breakdown for inspected images.
  console.log('\n=== Detailed breakdown for inspected images ===');
  for (const id of INSPECT_IDS) {
    const img = (data ?? []).find((d: any) => d.id === id);
    if (!img) {
      console.log(`\n[${id}] NOT FOUND in fetched batch`);
      continue;
    }
    const inPrefilter = (img.color_families ?? []).includes(TARGET);
    const { score, totals, breakdown } = scoreImage(img);
    console.log(
      `\n[${id}] ${img.path}\n  in_prefilter=${inPrefilter}  pink_score=${score.toFixed(1)}\n  totals: ${Object.entries(
        totals
      )
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}=${v.toFixed(1)}`)
        .join(' ')}`
    );
    breakdown.forEach(b => console.log(b));
  }
}

main();
