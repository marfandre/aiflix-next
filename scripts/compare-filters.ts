import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const POSITION_WEIGHT = [35, 25, 20, 12, 8];

const DRAIN_NEIGHBORS: Record<string, string[]> = {
  pink:   ['mauve', 'peach'],
  red:    ['brown', 'peach'],
  purple: ['mauve', 'indigo'],
  orange: ['peach', 'brown'],
};

const TEST_FAMILIES = ['pink', 'red', 'purple', 'indigo', 'blue', 'orange', 'green', 'mauve', 'peach'];

interface ImageData {
  id: string;
  color_families: string[];
  color_weights: number[] | null;
  color_family_weights: Array<Record<string, number>> | null;
  path: string;
}

function analyze(img: ImageData, targetFam: string) {
  const families = img.color_families ?? [];
  const weights = img.color_weights ?? null;
  const familyWeights = img.color_family_weights ?? null;

  const totals: Record<string, number> = {};
  let score = 0;
  const n = Math.max(families.length, familyWeights?.length ?? 0);

  for (let i = 0; i < n && i < 5; i++) {
    const pw = weights?.[i] ?? POSITION_WEIGHT[i] ?? 5;
    if (familyWeights && familyWeights[i]) {
      const fw = familyWeights[i];
      for (const [fam, prob] of Object.entries(fw)) {
        totals[fam] = (totals[fam] ?? 0) + pw * prob;
      }
      const prob = fw[targetFam] ?? 0;
      if (prob > 0) score += pw * prob;
    } else if (families[i] === targetFam) {
      score += pw;
      totals[targetFam] = (totals[targetFam] ?? 0) + pw;
    }
  }

  const requestedTotal = totals[targetFam] ?? 0;
  const totalMass = Object.values(totals).reduce((a, b) => a + b, 0);
  const share = totalMass > 0 ? requestedTotal / totalMass : 0;

  // Drain check
  const drainFams = DRAIN_NEIGHBORS[targetFam] ?? [];
  let maxDrain = 0;
  for (const d of drainFams) {
    if ((totals[d] ?? 0) > maxDrain) maxDrain = totals[d];
  }

  return { score, requestedTotal, totalMass, share, maxDrain };
}

async function main() {
  // Fetch all images with color data
  const { data: allImages, error } = await supa
    .from("images_meta")
    .select("id, color_families, color_weights, color_family_weights, path")
    .not("color_families", "is", null);

  if (error || !allImages) {
    console.error("Failed to fetch:", error);
    return;
  }

  console.log(`Total images with color data: ${allImages.length}\n`);

  for (const targetFam of TEST_FAMILIES) {
    // SQL prefilter simulation
    const prefiltered = allImages.filter((img: any) =>
      (img.color_families as string[]).includes(targetFam)
    );

    if (prefiltered.length === 0) {
      console.log(`=== ${targetFam.toUpperCase()} === no images in prefilter, skipping\n`);
      continue;
    }

    const analyzed = prefiltered.map((img: any) => ({
      ...analyze(img as ImageData, targetFam),
      id: img.id,
      path: img.path,
    }));

    // Apply 3 filter variants
    const minWeight = 3;

    // Variant 1: drain + share 0.18 (current)
    const v1 = analyzed.filter(a => a.score >= minWeight && a.requestedTotal >= a.maxDrain && a.share >= 0.18);

    // Variant 2: drain + share 0.12
    const v2 = analyzed.filter(a => a.score >= minWeight && a.requestedTotal >= a.maxDrain && a.share >= 0.12);

    // Variant 3: drain only (no share)
    const v3 = analyzed.filter(a => a.score >= minWeight && a.requestedTotal >= a.maxDrain);

    // What v2 adds over v1
    const v1ids = new Set(v1.map(a => a.id));
    const v2ids = new Set(v2.map(a => a.id));
    const v3ids = new Set(v3.map(a => a.id));

    const addedByV2 = analyzed.filter(a => v2ids.has(a.id) && !v1ids.has(a.id));
    const addedByV3 = analyzed.filter(a => v3ids.has(a.id) && !v2ids.has(a.id));

    console.log(`=== ${targetFam.toUpperCase()} === prefilter: ${prefiltered.length}`);
    console.log(`  V1 (drain + share≥0.18): ${v1.length} results`);
    console.log(`  V2 (drain + share≥0.12): ${v2.length} results`);
    console.log(`  V3 (drain only):         ${v3.length} results`);

    if (addedByV2.length > 0) {
      console.log(`\n  V2 adds over V1 (+${addedByV2.length}):`);
      addedByV2.sort((a, b) => b.share - a.share);
      for (const a of addedByV2) {
        const fname = a.path?.split('/').pop() ?? a.id;
        console.log(`    share=${(a.share * 100).toFixed(1)}%  score=${a.score.toFixed(1)}  total=${a.requestedTotal.toFixed(1)}  drain=${a.maxDrain.toFixed(1)}  ${fname}`);
      }
    }

    if (addedByV3.length > 0) {
      console.log(`\n  V3 adds over V2 (+${addedByV3.length}):`);
      addedByV3.sort((a, b) => b.share - a.share);
      for (const a of addedByV3) {
        const fname = a.path?.split('/').pop() ?? a.id;
        console.log(`    share=${(a.share * 100).toFixed(1)}%  score=${a.score.toFixed(1)}  total=${a.requestedTotal.toFixed(1)}  drain=${a.maxDrain.toFixed(1)}  ${fname}`);
      }
    }

    // Show what V1 filtered out (below 0.18 share but passed drain)
    const filteredByShare = analyzed.filter(a => a.score >= minWeight && a.requestedTotal >= a.maxDrain && a.share < 0.18);
    if (filteredByShare.length > 0) {
      console.log(`\n  Filtered by share<0.18 (passed drain): ${filteredByShare.length}`);
      filteredByShare.sort((a, b) => b.share - a.share);
      for (const a of filteredByShare) {
        const fname = a.path?.split('/').pop() ?? a.id;
        console.log(`    share=${(a.share * 100).toFixed(1)}%  score=${a.score.toFixed(1)}  total=${a.requestedTotal.toFixed(1)}  ${fname}`);
      }
    }

    console.log('');
  }
}

main();
