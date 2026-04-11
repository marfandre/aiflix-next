// scripts/backfill-jina-embeddings.ts
// Скрипт для генерации Jina-эмбеддингов для всего существующего контента
//
// Запуск: npx tsx scripts/backfill-jina-embeddings.ts
//
// Что делает:
// 1. Берёт все картинки и видео БЕЗ embedding_jina
// 2. Для каждого batch: отправляет URL изображений в Jina API → 1024-мерные векторы
// 3. Сохраняет в колонку embedding_jina (pgvector)

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { getImageEmbedding } from "../lib/jinaEmbedding";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BATCH_SIZE = 1; // По одной — rate limit 100k tokens/min на бесплатном плане
const DELAY_MS = 10000; // 10 сек между запросами (~6 req/min ≈ 90k tokens/min)

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function backfillImages() {
  console.log("\n=== Backfilling image Jina embeddings ===\n");

  const { data: images, error } = await supabase
    .from("images_meta")
    .select("id, path, title")
    .is("embedding_jina", null)
    .not("path", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching images:", error);
    return 0;
  }

  console.log(`Found ${images?.length ?? 0} images without Jina embeddings\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < (images?.length ?? 0); i++) {
    const img = images![i];

    const { data: urlData } = supabase.storage
      .from("images")
      .getPublicUrl(img.path);

    console.log(
      `  [${i + 1}/${images!.length}] ${img.title || img.id}`
    );

    // getImageEmbedding has built-in retry on 429
    const embedding = await getImageEmbedding(urlData.publicUrl);

    if (!embedding) {
      console.error(`  [FAIL] No embedding`);
      failed++;
    } else {
      const { error: updateError } = await supabase
        .from("images_meta")
        .update({ embedding_jina: `[${embedding.join(",")}]` })
        .eq("id", img.id);

      if (updateError) {
        console.error(`  [FAIL] DB error:`, updateError);
        failed++;
      } else {
        success++;
        console.log(`  [OK] ${embedding.length} dims`);
      }
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nImages done: ${success} success, ${failed} failed\n`);
  return success;
}

async function backfillVideos() {
  console.log("\n=== Backfilling video Jina embeddings ===\n");

  const { data: films, error } = await supabase
    .from("films")
    .select("id, playback_id, title")
    .is("embedding_jina", null)
    .not("playback_id", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching films:", error);
    return 0;
  }

  console.log(`Found ${films?.length ?? 0} videos without Jina embeddings\n`);

  let success = 0;
  let failed = 0;

  // Видео обрабатываем по одному (thumbnail URL через Mux)
  for (const film of films ?? []) {
    const thumbnailUrl = `https://image.mux.com/${film.playback_id}/thumbnail.jpg?time=1&width=400`;

    console.log(
      `  [${success + failed + 1}/${films!.length}] Processing video: ${film.title || film.id}`
    );

    const embedding = await getImageEmbedding(thumbnailUrl);
    if (!embedding) {
      console.error(`  [FAIL] Could not generate embedding for ${film.id}`);
      failed++;
      continue;
    }

    const { error: updateError } = await supabase
      .from("films")
      .update({ embedding_jina: `[${embedding.join(",")}]` })
      .eq("id", film.id);

    if (updateError) {
      console.error(`  [FAIL] DB error for ${film.id}:`, updateError);
      failed++;
    } else {
      success++;
      console.log(`  [OK] Embedding saved (${embedding.length} dims)`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nVideos done: ${success} success, ${failed} failed\n`);
  return success;
}

async function main() {
  console.log("========================================");
  console.log("  Jina Embedding Backfill Script");
  console.log("  Model: jina-clip-v2");
  console.log("  Embedding size: 1024 dimensions");
  console.log("========================================\n");

  const imgCount = await backfillImages();
  const vidCount = await backfillVideos();

  console.log("\n========================================");
  console.log(`  Total: ${imgCount + vidCount} embeddings generated`);
  console.log("========================================");
}

main().catch(console.error);
