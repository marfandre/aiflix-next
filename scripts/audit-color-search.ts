// Audits color search across ALL families using the exact production logic
// from ImageFeedClient.tsx. Reports for each family:
//   - prefilter count (SQL: family in color_families)
//   - final count (after share + drain checks)
//   - what was killed by share check
//   - what was killed by drain check
//   - top-10 results (highest score)
//
// Run: npx tsx scripts/audit-color-search.ts

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const POSITION_WEIGHT = [35, 25, 20, 12, 8];
const MIN_WEIGHT = 3;

const DRAIN_NEIGHBORS: Record<string, string[]> = {
  pink:   ['mauve', 'peach'],
  red:    ['brown', 'peach'],
  purple: ['mauve', 'indigo'],
  orange: ['peach', 'brown'],
};

const SHARE_HIGH: Record<string, boolean> = {
  pink: true, red: true, orange: true, peach: true,
};

const ALL_FAMILIES = [
  'pink', 'red', 'orange', 'peach', 'mauve',
  'purple', 'indigo', 'blue', 'green', 'yellow',
  'brown', 'white', 'black',
];

interface Img {
  id: string;
  path: string;
  color_families: string[];
  color_weights: number[] | null;
  color_family_weights: Array<Record<string, number>> | null;
}

function score(img: Img, target: string) {
  const families = img.color_families ?? [];
  const weights = img.color_weights;
  const fws = img.color_family_weights;

  const totals: Record<string, number> = {};
  let s = 0;
  const n = Math.max(families.length, fws?.length ?? 0);

  for (let i = 0; i < n && i < 5; i++) {
    const pw = weights?.[i] ?? POSITION_WEIGHT[i] ?? 5;
    if (fws?.[i]) {
      const fw = fws[i];
      for (const [fam, prob] of Object.entries(fw)) {
        totals[fam] = (totals[fam] ?? 0) + pw * prob;
      }
      const p = fw[target] ?? 0;
      if (p > 0) s += pw * p;
    } else if (families[i] === target) {
      s += pw;
      totals[target] = (totals[target] ?? 0) + pw;
    }
  }

  const requestedTotal = totals[target] ?? 0;
  const totalMass = Object.values(totals).reduce((a, b) => a + b, 0);
  const share = totalMass > 0 ? requestedTotal / totalMass : 0;

  const drains = DRAIN_NEIGHBORS[target] ?? [];
  let maxDrain = 0;
  for (const d of drains) {
    if ((totals[d] ?? 0) > maxDrain) maxDrain = totals[d];
  }

  const requestedIsTop1 = families.includes(target);
  return { score: s, requestedTotal, totalMass, share, maxDrain, requestedIsTop1, totals };
}

async function main() {
  const { data, error } = await supa
    .from("images_meta")
    .select("id, path, color_families, color_weights, color_family_weights")
    .not("color_families", "is", null);

  if (error || !data) {
    console.error("Fetch failed:", error);
    return;
  }

  console.log(`Total indexed images: ${data.length}\n`);
  console.log(
    'family       prefilter  final  killByShare  killByDrain  shareMin'
  );
  console.log('-----------  ---------  -----  -----------  -----------  --------');

  const summary: Array<{
    family: string;
    prefilter: number;
    final: number;
    killShare: number;
    killDrain: number;
    shareMin: number;
    killShareSamples: any[];
    killDrainSamples: any[];
  }> = [];

  for (const fam of ALL_FAMILIES) {
    const prefilter = (data as Img[]).filter((img) =>
      (img.color_families ?? []).includes(fam)
    );

    const shareMin = SHARE_HIGH[fam] ? 0.18 : 0.10;

    const scored = prefilter.map((img) => ({ img, ...score(img, fam) }));

    const passMin = scored.filter((s) => s.score >= MIN_WEIGHT);
    const drainPass = passMin.filter(
      (s) => s.requestedIsTop1 || s.requestedTotal >= s.maxDrain
    );
    const final = drainPass.filter((s) => s.share >= shareMin);

    const killByDrain = passMin.filter(
      (s) => !(s.requestedIsTop1 || s.requestedTotal >= s.maxDrain)
    );
    const killByShare = drainPass.filter((s) => s.share < shareMin);

    summary.push({
      family: fam,
      prefilter: prefilter.length,
      final: final.length,
      killShare: killByShare.length,
      killDrain: killByDrain.length,
      shareMin,
      killShareSamples: killByShare
        .sort((a, b) => b.share - a.share)
        .slice(0, 5),
      killDrainSamples: killByDrain
        .sort((a, b) => b.maxDrain - a.maxDrain)
        .slice(0, 5),
    });

    console.log(
      `${fam.padEnd(11)}  ${String(prefilter.length).padStart(9)}  ${String(
        final.length
      ).padStart(5)}  ${String(killByShare.length).padStart(11)}  ${String(
        killByDrain.length
      ).padStart(11)}  ${shareMin.toFixed(2)}`
    );
  }

  // Detailed killed samples per family
  console.log('\n\n=== Killed samples (top by severity) ===');
  for (const s of summary) {
    if (s.killShare === 0 && s.killDrain === 0) continue;
    console.log(`\n--- ${s.family.toUpperCase()} ---`);
    if (s.killByShareSamples?.length || s.killShareSamples.length) {
      console.log(`  Killed by SHARE (<${s.shareMin}):`);
      for (const a of s.killShareSamples) {
        const fname = a.img.path?.split('/').pop() ?? a.img.id;
        const top = Object.entries(a.totals as Record<string, number>)
          .sort((x, y) => y[1] - x[1])
          .slice(0, 3)
          .map(([k, v]) => `${k}=${v.toFixed(1)}`)
          .join(' ');
        console.log(
          `    share=${(a.share * 100).toFixed(1)}% score=${a.score.toFixed(1)} | ${top} | ${fname}`
        );
      }
    }
    if (s.killDrainSamples.length) {
      console.log(`  Killed by DRAIN:`);
      for (const a of s.killDrainSamples) {
        const fname = a.img.path?.split('/').pop() ?? a.img.id;
        const top = Object.entries(a.totals as Record<string, number>)
          .sort((x, y) => y[1] - x[1])
          .slice(0, 3)
          .map(([k, v]) => `${k}=${v.toFixed(1)}`)
          .join(' ');
        console.log(
          `    req=${a.requestedTotal.toFixed(1)} drain=${a.maxDrain.toFixed(1)} | ${top} | ${fname}`
        );
      }
    }
  }
}

main();
