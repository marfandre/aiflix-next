// scripts/backfill-local-embeddings.ts
// Генерация локальных Jina CLIP v1 эмбеддингов (768 dims) для всего контента.
//
// Запуск: npx tsx scripts/backfill-local-embeddings.ts
//
// Что делает:
// 1. Находит все картинки и видео БЕЗ embedding_local
// 2. Поочерёдно прогоняет через локальную модель
// 3. Сохраняет в колонку embedding_local
//
// Первый запуск качает модель (~700MB total: text + vision) в ~/.cache/huggingface.

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { getImageEmbedding } from "../lib/localEmbedding";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function backfillImages() {
  console.log("\n=== Backfilling image embeddings ===\n");

  const { data: images, error } = await supabase
    .from("images_meta")
    .select("id, path, title")
    .is("embedding_local", null)
    .not("path", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching images:", error);
    return 0;
  }

  const total = images?.length ?? 0;
  console.log(`Found ${total} images without local embeddings\n`);

  let success = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < total; i++) {
    const img = images![i];
    const { data: urlData } = supabase.storage.from("images").getPublicUrl(img.path);

    const t0 = Date.now();
    const embedding = await getImageEmbedding(urlData.publicUrl);
    const ms = Date.now() - t0;

    if (!embedding) {
      console.error(`  [${i + 1}/${total}] FAIL: ${img.title || img.id}`);
      failed++;
      continue;
    }

    const { error: updateError } = await supabase
      .from("images_meta")
      .update({ embedding_local: `[${embedding.join(",")}]` })
      .eq("id", img.id);

    if (updateError) {
      console.error(`  [${i + 1}/${total}] DB FAIL: ${updateError.message}`);
      failed++;
    } else {
      success++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const eta = total > i + 1 ? (((Date.now() - startTime) / (i + 1)) * (total - i - 1) / 1000).toFixed(0) : "0";
      console.log(`  [${i + 1}/${total}] ok (${ms}ms)  elapsed=${elapsed}s  eta=${eta}s`);
    }
  }

  console.log(`\nImages done: ${success} ok, ${failed} failed\n`);
  return success;
}

async function backfillVideos() {
  console.log("\n=== Backfilling video embeddings ===\n");

  const { data: films, error } = await supabase
    .from("films")
    .select("id, playback_id, title")
    .is("embedding_local", null)
    .not("playback_id", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching films:", error);
    return 0;
  }

  const total = films?.length ?? 0;
  console.log(`Found ${total} videos without local embeddings\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < total; i++) {
    const film = films![i];
    const thumbUrl = `https://image.mux.com/${film.playback_id}/thumbnail.jpg?time=1&width=400`;

    const t0 = Date.now();
    const embedding = await getImageEmbedding(thumbUrl);
    const ms = Date.now() - t0;

    if (!embedding) {
      console.error(`  [${i + 1}/${total}] FAIL: ${film.title || film.id}`);
      failed++;
      continue;
    }

    const { error: updateError } = await supabase
      .from("films")
      .update({ embedding_local: `[${embedding.join(",")}]` })
      .eq("id", film.id);

    if (updateError) {
      console.error(`  [${i + 1}/${total}] DB FAIL: ${updateError.message}`);
      failed++;
    } else {
      success++;
      console.log(`  [${i + 1}/${total}] ok (${ms}ms)  ${film.title || film.id}`);
    }
  }

  console.log(`\nVideos done: ${success} ok, ${failed} failed\n`);
  return success;
}

async function main() {
  console.log("========================================");
  console.log("  Local Embedding Backfill");
  console.log("  Model: jinaai/jina-clip-v1 (768 dims)");
  console.log("========================================\n");

  const imgCount = await backfillImages();
  const vidCount = await backfillVideos();

  console.log("\n========================================");
  console.log(`  Total: ${imgCount + vidCount} embeddings generated`);
  console.log("========================================");
}

main().catch(console.error);
