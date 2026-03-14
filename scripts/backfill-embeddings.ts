// scripts/backfill-embeddings.ts
// Скрипт для генерации CLIP-эмбеддингов для всего существующего контента
//
// Запуск: npx tsx scripts/backfill-embeddings.ts
//
// Что делает:
// 1. Берёт все картинки и видео БЕЗ эмбеддинга
// 2. Для каждого: скачивает изображение → CLIP → 512-мерный вектор
// 3. Сохраняет вектор в колонку embedding (pgvector)
//
// Первый запуск будет медленнее — модель (~87MB) скачивается и кешируется

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { getImageEmbedding } from "../lib/clipEmbedding";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function backfillImages() {
  console.log("\n=== Backfilling image embeddings ===\n");

  // Берём картинки без эмбеддинга
  const { data: images, error } = await supabase
    .from("images_meta")
    .select("id, path, title")
    .is("embedding", null)
    .not("path", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching images:", error);
    return 0;
  }

  console.log(`Found ${images?.length ?? 0} images without embeddings\n`);

  let success = 0;
  let failed = 0;

  for (const img of images ?? []) {
    try {
      // Получаем публичный URL картинки из Supabase Storage
      const { data: urlData } = supabase.storage
        .from("images")
        .getPublicUrl(img.path);

      const imageUrl = urlData.publicUrl;
      if (!imageUrl) {
        console.error(`  [SKIP] No URL for image ${img.id}`);
        failed++;
        continue;
      }

      console.log(
        `  [${success + failed + 1}/${images!.length}] Processing image: ${img.title || img.id}`
      );

      // CLIP: изображение → вектор
      const embedding = await getImageEmbedding(imageUrl);
      if (!embedding) {
        console.error(`  [FAIL] Could not generate embedding for ${img.id}`);
        failed++;
        continue;
      }

      // Сохраняем в БД (pgvector принимает строку "[0.1,0.2,...]")
      const { error: updateError } = await supabase
        .from("images_meta")
        .update({ embedding: `[${embedding.join(",")}]` })
        .eq("id", img.id);

      if (updateError) {
        console.error(`  [FAIL] DB error for ${img.id}:`, updateError);
        failed++;
      } else {
        success++;
        console.log(
          `  [OK] Embedding saved (${embedding.length} dims)`
        );
      }
    } catch (err) {
      console.error(`  [FAIL] Error processing ${img.id}:`, err);
      failed++;
    }
  }

  console.log(
    `\nImages done: ${success} success, ${failed} failed\n`
  );
  return success;
}

async function backfillVideos() {
  console.log("\n=== Backfilling video embeddings ===\n");

  // Берём видео без эмбеддинга, но с playback_id (нужен для thumbnail)
  const { data: films, error } = await supabase
    .from("films")
    .select("id, playback_id, title")
    .is("embedding", null)
    .not("playback_id", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching films:", error);
    return 0;
  }

  console.log(`Found ${films?.length ?? 0} videos without embeddings\n`);

  let success = 0;
  let failed = 0;

  for (const film of films ?? []) {
    try {
      // Mux thumbnail — визуальное представление видео
      const thumbnailUrl = `https://image.mux.com/${film.playback_id}/thumbnail.jpg?time=1&width=400`;

      console.log(
        `  [${success + failed + 1}/${films!.length}] Processing video: ${film.title || film.id}`
      );

      // CLIP: thumbnail → вектор
      const embedding = await getImageEmbedding(thumbnailUrl);
      if (!embedding) {
        console.error(`  [FAIL] Could not generate embedding for ${film.id}`);
        failed++;
        continue;
      }

      // Сохраняем в БД
      const { error: updateError } = await supabase
        .from("films")
        .update({ embedding: `[${embedding.join(",")}]` })
        .eq("id", film.id);

      if (updateError) {
        console.error(`  [FAIL] DB error for ${film.id}:`, updateError);
        failed++;
      } else {
        success++;
        console.log(
          `  [OK] Embedding saved (${embedding.length} dims)`
        );
      }
    } catch (err) {
      console.error(`  [FAIL] Error processing ${film.id}:`, err);
      failed++;
    }
  }

  console.log(
    `\nVideos done: ${success} success, ${failed} failed\n`
  );
  return success;
}

async function main() {
  console.log("========================================");
  console.log("  CLIP Embedding Backfill Script");
  console.log("  Model: Xenova/clip-vit-base-patch32");
  console.log("  Embedding size: 512 dimensions");
  console.log("========================================\n");

  const imgCount = await backfillImages();
  const vidCount = await backfillVideos();

  console.log("\n========================================");
  console.log(`  Total: ${imgCount + vidCount} embeddings generated`);
  console.log("========================================");
}

main().catch(console.error);
