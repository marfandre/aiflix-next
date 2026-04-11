// app/api/semantic-search/route.ts
// Семантический поиск: текстовый запрос → local Jina CLIP v1 embedding → pgvector

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTextEmbedding } from "@/lib/localEmbedding";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_ENABLE_SEMANTIC_SEARCH !== "1") {
    return NextResponse.json(
      { error: "Semantic search is disabled on this deployment" },
      { status: 503 }
    );
  }

  const sp = req.nextUrl.searchParams;
  const query = sp.get("q")?.trim();
  const searchType = sp.get("type") ?? "all"; // 'all' | 'images' | 'videos'
  const limit = Math.min(Number(sp.get("limit") ?? 30), 100);
  const threshold = Number(sp.get("threshold") ?? 0.05);

  if (!query) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  // Получаем текстовый эмбеддинг через Voyage
  const embedding = await getTextEmbedding(query);
  if (!embedding) {
    return NextResponse.json(
      { error: "Не удалось получить эмбеддинг для запроса" },
      { status: 500 }
    );
  }

  // Вызываем pgvector-функцию
  const { data, error } = await supabase.rpc("search_by_embedding_local", {
    query_embedding: `[${embedding.join(",")}]`,
    match_threshold: threshold,
    match_count: limit,
    search_type: searchType === "videos" ? "videos" : searchType === "images" ? "images" : "all",
  });

  if (error) {
    console.error("[semantic-search] rpc error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = (data ?? []) as { id: string; media_type: string; similarity: number }[];
  console.log(`[semantic-search] q="${query}" threshold=${threshold} results=${results.length}`, results.slice(0, 5).map(r => ({ t: r.media_type, s: r.similarity.toFixed(3) })));

  // Подгружаем данные для каждого результата
  const imageIds = results.filter((r) => r.media_type === "image").map((r) => r.id);
  const videoIds = results.filter((r) => r.media_type === "video").map((r) => r.id);

  let images: any[] = [];
  let films: any[] = [];

  if (imageIds.length > 0) {
    const { data: imgData } = await supabase
      .from("images_meta")
      .select("id, user_id, path, title, description, prompt, created_at, colors, accent_colors, color_positions, model, aspect_ratio, tags, images_count, source, source_author, source_url, seed, profiles(username, avatar_url)")
      .in("id", imageIds);
    images = imgData ?? [];
  }

  if (videoIds.length > 0) {
    const { data: filmData } = await supabase
      .from("films")
      .select("id, author_id, title, description, prompt, playback_id, created_at, model, aspect_ratio, genres, mood, colors, colors_preview, colors_full, colors_full_interval, color_mode, status")
      .in("id", videoIds);

    // Обогащаем профилями отдельно (как в VideoFeedClient)
    const authorIds = [...new Set((filmData ?? []).map((f: any) => f.author_id).filter(Boolean))] as string[];
    let profilesMap: Record<string, { username: string | null; avatar_url: string | null }> = {};
    if (authorIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", authorIds);
      for (const p of profilesData ?? []) {
        profilesMap[p.id] = { username: p.username, avatar_url: p.avatar_url };
      }
    }
    films = (filmData ?? []).map((f: any) => ({
      ...f,
      profiles: f.author_id && profilesMap[f.author_id] ? profilesMap[f.author_id] : null,
    }));
  }

  // Сортируем результаты по similarity (сохраняем порядок из pgvector)
  const imageMap = new Map(images.map((i) => [i.id, i]));
  const filmMap = new Map(films.map((f) => [f.id, f]));

  const sortedResults = results.map((r) => ({
    ...r,
    data: r.media_type === "image" ? imageMap.get(r.id) : filmMap.get(r.id),
  })).filter((r) => r.data);

  return NextResponse.json({
    query,
    results: sortedResults,
    images: sortedResults.filter((r) => r.media_type === "image").map((r) => r.data),
    films: sortedResults.filter((r) => r.media_type === "video").map((r) => r.data),
  });
}
