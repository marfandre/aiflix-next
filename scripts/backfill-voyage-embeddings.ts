// scripts/backfill-voyage-embeddings.ts
// Генерация Voyage multimodal-3.5 эмбеддингов для всего существующего контента.
//
// Запуск: npx tsx scripts/backfill-voyage-embeddings.ts
//
// Что делает:
// 1. Берёт все картинки и видео БЕЗ embedding_voyage
// 2. Батчами по BATCH_SIZE отправляет URL изображений в Voyage API
// 3. Сохраняет в колонку embedding_voyage (pgvector)
//
// Voyage multimodal-3.5 free tier: 50M токенов/месяц, ~3.5k токенов на картинку
// (560 пикселей = 1 токен). Весь бэкфилл ~500 картинок ≈ 1.8M токенов.

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { getImageEmbeddingsBatch } from "../lib/voyageEmbedding";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BATCH_SIZE = 1;
const DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function backfillImages() {
  console.log("\n=== Backfilling image Voyage embeddings ===\n");

  const { data: images, error } = await supabase
    .from("images_meta")
    .select("id, path, title")
    .is("embedding_voyage", null)
    .not("path", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching images:", error);
    return 0;
  }

  console.log(`Found ${images?.length ?? 0} images without Voyage embeddings\n`);

  let success = 0;
  let failed = 0;
  const total = images?.length ?? 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = images!.slice(i, i + BATCH_SIZE);
    const urls = batch.map((img) => {
      const { data: urlData } = supabase.storage
        .from("images")
        .getPublicUrl(img.path);
      return urlData.publicUrl;
    });

    console.log(`  [${i + 1}-${Math.min(i + BATCH_SIZE, total)}/${total}] batch of ${batch.length}`);

    const embeddings = await getImageEmbeddingsBatch(urls);

    for (let j = 0; j < batch.length; j++) {
      const img = batch[j];
      const embedding = embeddings[j];

      if (!embedding) {
        console.error(`    [FAIL] ${img.title || img.id}`);
        failed++;
        continue;
      }

      const { error: updateError } = await supabase
        .from("images_meta")
        .update({ embedding_voyage: `[${embedding.join(",")}]` })
        .eq("id", img.id);

      if (updateError) {
        console.error(`    [FAIL] DB error for ${img.id}:`, updateError.message);
        failed++;
      } else {
        success++;
      }
    }

    console.log(`    → progress: ${success} ok / ${failed} fail`);
    await sleep(DELAY_MS);
  }

  console.log(`\nImages done: ${success} success, ${failed} failed\n`);
  return success;
}

async function backfillVideos() {
  console.log("\n=== Backfilling video Voyage embeddings ===\n");

  const { data: films, error } = await supabase
    .from("films")
    .select("id, playback_id, title")
    .is("embedding_voyage", null)
    .not("playback_id", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching films:", error);
    return 0;
  }

  console.log(`Found ${films?.length ?? 0} videos without Voyage embeddings\n`);

  let success = 0;
  let failed = 0;
  const total = films?.length ?? 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = films!.slice(i, i + BATCH_SIZE);
    const urls = batch.map(
      (f) => `https://image.mux.com/${f.playback_id}/thumbnail.jpg?time=1&width=400`
    );

    console.log(`  [${i + 1}-${Math.min(i + BATCH_SIZE, total)}/${total}] batch of ${batch.length}`);

    const embeddings = await getImageEmbeddingsBatch(urls);

    for (let j = 0; j < batch.length; j++) {
      const film = batch[j];
      const embedding = embeddings[j];

      if (!embedding) {
        console.error(`    [FAIL] ${film.title || film.id}`);
        failed++;
        continue;
      }

      const { error: updateError } = await supabase
        .from("films")
        .update({ embedding_voyage: `[${embedding.join(",")}]` })
        .eq("id", film.id);

      if (updateError) {
        console.error(`    [FAIL] DB error for ${film.id}:`, updateError.message);
        failed++;
      } else {
        success++;
      }
    }

    console.log(`    → progress: ${success} ok / ${failed} fail`);
    await sleep(DELAY_MS);
  }

  console.log(`\nVideos done: ${success} success, ${failed} failed\n`);
  return success;
}

async function main() {
  console.log("========================================");
  console.log("  Voyage Embedding Backfill Script");
  console.log("  Model: voyage-multimodal-3.5");
  console.log("  Embedding size: 1024 dimensions");
  console.log("========================================\n");

  const imgCount = await backfillImages();
  const vidCount = await backfillVideos();

  console.log("\n========================================");
  console.log(`  Total: ${imgCount + vidCount} embeddings generated`);
  console.log("========================================");
}

main().catch(console.error);
