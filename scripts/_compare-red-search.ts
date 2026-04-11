// scripts/_compare-red-search.ts
// Сравнение двух режимов поиска "красного":
//   1) семантический (CLIP text "red" -> embedding -> pgvector)
//   2) цветовой фильтр (color_families contains 'red')
//
// Запуск: npx tsx scripts/_compare-red-search.ts

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { getTextEmbedding } from "../lib/localEmbedding";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const QUERY = "red";
const LIMIT = 40;

async function semanticSearch(): Promise<{ id: string; sim: number }[]> {
  const emb = await getTextEmbedding(QUERY);
  if (!emb) throw new Error("text embedding failed");

  const { data, error } = await supabase.rpc("search_by_embedding_local", {
    query_embedding: `[${emb.join(",")}]`,
    match_threshold: 0.05,
    match_count: LIMIT,
    search_type: "images",
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, sim: r.similarity }));
}

async function colorFilterSearch(): Promise<{ id: string }[]> {
  const { data, error } = await supabase
    .from("images_meta")
    .select("id, created_at")
    .contains("color_families", ["red"])
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id }));
}

async function fetchTitles(ids: string[]): Promise<Map<string, { title: string | null; colors: string[] | null; families: string[] | null }>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase
    .from("images_meta")
    .select("id, title, colors, color_families")
    .in("id", ids);
  const map = new Map<string, any>();
  for (const r of data ?? []) {
    map.set(r.id, { title: r.title, colors: r.colors, families: r.color_families });
  }
  return map;
}

async function main() {
  console.log(`\n=== Сравнение поиска "${QUERY}" ===\n`);

  const [semantic, colorOnly] = await Promise.all([
    semanticSearch(),
    colorFilterSearch(),
  ]);

  const allIds = [...new Set([...semantic.map((r) => r.id), ...colorOnly.map((r) => r.id)])];
  const meta = await fetchTitles(allIds);

  const semIds = new Set(semantic.map((r) => r.id));
  const colIds = new Set(colorOnly.map((r) => r.id));
  const overlap = [...semIds].filter((id) => colIds.has(id));

  console.log(`Семантика (CLIP "red"):  ${semantic.length} результатов`);
  console.log(`Цвет (families=[red]):    ${colorOnly.length} результатов`);
  console.log(`Пересечение:              ${overlap.length}`);
  console.log(`Только семантика:         ${semantic.length - overlap.length}`);
  console.log(`Только цвет:              ${colorOnly.length - overlap.length}\n`);

  console.log("--- TOP-15 семантического поиска ---");
  semantic.slice(0, 15).forEach((r, i) => {
    const m = meta.get(r.id);
    const inColor = colIds.has(r.id) ? "✓" : " ";
    const fams = m?.families?.join(",") ?? "-";
    console.log(`${(i + 1).toString().padStart(2)}. [${inColor}] sim=${r.sim.toFixed(3)}  fams=${fams.padEnd(30)}  ${m?.title ?? "(no title)"}`);
  });

  console.log("\n--- TOP-15 цветового фильтра ---");
  colorOnly.slice(0, 15).forEach((r, i) => {
    const m = meta.get(r.id);
    const inSem = semIds.has(r.id) ? "✓" : " ";
    const semItem = semantic.find((s) => s.id === r.id);
    const sim = semItem ? semItem.sim.toFixed(3) : "  -  ";
    const fams = m?.families?.join(",") ?? "-";
    console.log(`${(i + 1).toString().padStart(2)}. [${inSem}] sim=${sim}  fams=${fams.padEnd(30)}  ${m?.title ?? "(no title)"}`);
  });

  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
