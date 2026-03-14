// app/api/semantic-search/route.ts
// Семантический поиск через CLIP embeddings + pgvector
//
// GET /api/semantic-search?q=blue+ocean&type=all&limit=20

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const maxDuration = 60;

// Dynamic import to avoid bundling onnxruntime-node (404MB) into serverless function
async function getTextEmbedding(text: string) {
  const { getTextEmbedding: fn } = await import("@/lib/clipEmbedding");
  return fn(text);
}

// Трекинг состояния модели
let modelReady = false;
let modelLoading = false;

// Предзагрузка модели (fire-and-forget, не блокирует запросы)
async function ensureModelLoaded() {
  if (modelReady || modelLoading) return;
  modelLoading = true;
  try {
    console.log("[semantic-search] Pre-loading CLIP model...");
    // Делаем фиктивный запрос чтобы модель загрузилась
    await getTextEmbedding("warmup");
    modelReady = true;
    console.log("[semantic-search] CLIP model ready");
  } catch (err) {
    console.error("[semantic-search] Model pre-load failed:", err);
  } finally {
    modelLoading = false;
  }
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;

  const query = sp.get("q")?.trim();
  if (!query) {
    return NextResponse.json(
      { error: "Missing query parameter 'q'" },
      { status: 400 }
    );
  }

  const searchType = sp.get("type") ?? "all";
  const limit = Math.min(Number(sp.get("limit") ?? 20), 50);
  const threshold = Number(sp.get("threshold") ?? 0.22);

  try {
    // Если модель ещё не загружена — загружаем и просим клиент повторить
    if (!modelReady) {
      // Запускаем загрузку в фоне
      ensureModelLoaded();
      // Возвращаем 503 с Retry-After — клиент повторит через N секунд
      return NextResponse.json(
        { error: "MODEL_LOADING", message: "AI модель загружается, подождите..." },
        {
          status: 503,
          headers: { "Retry-After": "5" },
        }
      );
    }

    // 1. Текст → вектор через CLIP (модель уже в памяти — быстро)
    console.log(`[semantic-search] Query: "${query}"`);
    const embedding = await getTextEmbedding(query);
    if (!embedding) {
      return NextResponse.json(
        { error: "Failed to generate text embedding" },
        { status: 500 }
      );
    }

    console.log(`[semantic-search] Embedding generated (${embedding.length} dims)`);

    // Микропауза чтобы event loop обработал pending IO
    await new Promise((r) => setTimeout(r, 50));

    // 2. Вызываем pgvector — свежий клиент
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const embeddingStr = `[${embedding.join(",")}]`;

    // Retry logic
    let matches: any[] | null = null;
    let lastError: any = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error } = await supabase.rpc("search_by_embedding", {
        query_embedding: embeddingStr,
        match_threshold: threshold,
        match_count: limit,
        search_type: searchType === "videos" ? "videos" : searchType === "images" ? "images" : "all",
      });

      if (!error) {
        matches = data;
        break;
      }

      console.warn(`[semantic-search] RPC attempt ${attempt}/3 failed:`, error.message);
      lastError = error;

      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }

    if (matches === null) {
      console.error("[semantic-search] All RPC attempts failed:", lastError);
      return NextResponse.json(
        { error: lastError?.message ?? "Search failed" },
        { status: 500 }
      );
    }

    if (matches.length === 0) {
      return NextResponse.json({ films: [], images: [], query, total: 0 });
    }

    // Отсеиваем слабые результаты: similarity >= 92% от лучшего
    const bestSimilarity = Math.max(...matches.map((m: any) => m.similarity));
    const relativeThreshold = bestSimilarity * 0.92;
    matches = matches.filter((m: any) => m.similarity >= relativeThreshold);

    console.log(`[semantic-search] Best sim=${bestSimilarity.toFixed(3)}, cutoff=${relativeThreshold.toFixed(3)}, kept ${matches.length} results`);

    // 3. Получаем полные данные для найденных ID
    const imageIds = matches
      .filter((m: any) => m.media_type === "image")
      .map((m: any) => m.id);
    const filmIds = matches
      .filter((m: any) => m.media_type === "video")
      .map((m: any) => m.id);

    const similarityMap = new Map<string, number>();
    for (const m of matches) {
      similarityMap.set(m.id, m.similarity);
    }

    const [imagesResult, filmsResult] = await Promise.all([
      imageIds.length > 0
        ? supabase
            .from("images_meta")
            .select("id, title, colors, color_weights, tags, model, path, dominant_color, secondary_color, third_color, fourth_color, fifth_color")
            .in("id", imageIds)
        : Promise.resolve({ data: [], error: null }),
      filmIds.length > 0
        ? supabase
            .from("films")
            .select("id, title, genres, model, colors, color_names")
            .in("id", filmIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const images = (imagesResult.data ?? [])
      .map((img: any) => ({
        ...img,
        similarity: similarityMap.get(img.id) ?? 0,
      }))
      .sort((a: any, b: any) => b.similarity - a.similarity);

    const films = (filmsResult.data ?? [])
      .map((film: any) => ({
        ...film,
        similarity: similarityMap.get(film.id) ?? 0,
      }))
      .sort((a: any, b: any) => b.similarity - a.similarity);

    console.log(`[semantic-search] Found ${images.length} images, ${films.length} films for "${query}"`);

    return NextResponse.json({
      films,
      images,
      query,
      total: matches.length,
    });
  } catch (err: any) {
    console.error("[semantic-search] Error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
