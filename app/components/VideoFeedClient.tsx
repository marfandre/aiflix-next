"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Masonry from "react-masonry-css";
import VideoCard from "./video-feed/VideoCard";
import VideoModal from "./video-feed/VideoModal";
import type { VideoRow } from "./video-feed/types";

type Props = {
  userId: string | null;
  initialVideos?: VideoRow[];
  showAuthor?: boolean;
  isOwnerView?: boolean;
  profileId?: string;
};

const PAGE_SIZE = 40;

export default function VideoFeedClient({ userId, initialVideos, showAuthor = true, isOwnerView = false, profileId }: Props) {
  const [videos, setVideos] = useState<VideoRow[]>(initialVideos ?? []);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selected, setSelected] = useState<VideoRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const supa = createClientComponentClient();
  const sp = useSearchParams();
  const modelsFilter = sp.get("models") || "";

  // ---------- Build query ----------
  const buildQuery = useCallback((cursor?: string) => {
    let query = supa
      .from("films")
      .select("id, author_id, title, description, prompt, playback_id, created_at, model, aspect_ratio, genres, mood, colors, colors_preview, colors_full, colors_full_interval, color_mode, status")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (cursor) query = query.lt("created_at", cursor);

    if (modelsFilter) {
      const models = modelsFilter.split(",").map((m) => m.trim().toLowerCase()).filter(Boolean);
      if (models.length) {
        const orClause = models.map((m) => `model.ilike.%${m}%`).join(",");
        query = query.or(orClause);
      }
    }

    if (profileId) {
      query = query.eq("author_id", profileId);
    }

    return query;
  }, [supa, modelsFilter, profileId]);

  const enrichWithProfiles = useCallback(async (filmsData: any[]): Promise<VideoRow[]> => {
    if (!filmsData.length) return [];
    const authorIds = [...new Set(filmsData.map(f => f.author_id).filter(Boolean))] as string[];
    let profilesMap: Record<string, { username: string | null; avatar_url: string | null }> = {};

    if (authorIds.length > 0) {
      const { data: profilesData } = await supa
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", authorIds);

      for (const p of profilesData ?? []) {
        profilesMap[p.id] = { username: p.username, avatar_url: p.avatar_url };
      }
    }

    return filmsData.map(f => ({
      ...f,
      profiles: f.author_id && profilesMap[f.author_id] ? profilesMap[f.author_id] : null,
    }));
  }, [supa]);

  // ---------- Load videos (initial) ----------
  useEffect(() => {
    if (initialVideos && initialVideos.length > 0 && !modelsFilter) {
      setVideos(initialVideos);
      setHasMore(initialVideos.length >= PAGE_SIZE);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      const { data: filmsData, error } = await buildQuery();

      if (error) {
        console.error("video fetch error:", error);
        setVideos([]);
      } else {
        const enriched = await enrichWithProfiles(filmsData ?? []);
        setVideos(enriched);
        setHasMore((filmsData ?? []).length >= PAGE_SIZE);
      }
      setLoading(false);
    })();
  }, [buildQuery, enrichWithProfiles, initialVideos, modelsFilter]);

  // ---------- Load more (infinite scroll) ----------
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const lastVideo = videos[videos.length - 1];
    if (!lastVideo?.created_at) return;

    setLoadingMore(true);
    const { data, error } = await buildQuery(lastVideo.created_at);
    if (error) {
      console.error("video fetch more:", error);
    } else {
      const enriched = await enrichWithProfiles(data ?? []);
      setVideos((prev) => [...prev, ...enriched]);
      setHasMore((data ?? []).length >= PAGE_SIZE);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, videos, buildQuery, enrichWithProfiles]);

  // ---------- Intersection Observer ----------
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "600px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // Realtime subscription
  useEffect(() => {
    const channel = supa
      .channel("videos-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "films" }, async (payload) => {
        const newVideo = payload.new as VideoRow;
        if (newVideo.author_id) {
          const { data: profileData } = await supa
            .from("profiles")
            .select("username, avatar_url")
            .eq("id", newVideo.author_id)
            .maybeSingle();
          const enriched: VideoRow = {
            ...newVideo,
            profiles: profileData ? [{ username: profileData.username, avatar_url: profileData.avatar_url }] : [],
          };
          setVideos((prev) => [enriched, ...prev]);
        } else {
          setVideos((prev) => [newVideo, ...prev]);
        }
      })
      .subscribe();

    return () => { supa.removeChannel(channel); };
  }, [supa]);

  const openVideo = (v: VideoRow) => {
    setSelected(v);
    // Сохраняем текущие searchParams, иначе useSearchParams() в HomeContent
    // пересчитает tab и размонтирует модалку
    const search = window.location.search;
    window.history.pushState({ videoId: v.id }, "", `/film/${v.id}${search}`);
  };

  const closeModal = () => {
    setSelected(null);
    window.history.pushState({}, "", window.location.pathname.startsWith("/film/") ? "/" + window.location.search : window.location.pathname + window.location.search);
  };

  const deleteVideo = async (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u044D\u0442\u043E \u0432\u0438\u0434\u0435\u043E?")) return;
    setDeletingId(videoId);
    try {
      const res = await fetch("/api/videos/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Delete error:", data.error);
        alert("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u0438: " + (data.error || "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430"));
      } else {
        setVideos(prev => prev.filter(v => v.id !== videoId));
      }
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="py-6 text-gray-500">{"\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..."}</div>;
  if (videos.length === 0) return <div className="py-6 text-gray-500">{"\u041D\u0435\u0442 \u0432\u0438\u0434\u0435\u043E"}</div>;

  return (
    <>
      <div className="overflow-hidden rounded-2xl w-full">
        <Masonry
          breakpointCols={{ default: 5, 1100: 5, 900: 4, 700: 3, 500: 2 }}
          className="flex -ml-1 w-auto"
          columnClassName="pl-1 bg-clip-padding"
        >
          {videos.map((v) => (
            <VideoCard
              key={v.id}
              video={v}
              userId={userId}
              showAuthor={showAuthor}
              isOwnerView={isOwnerView}
              deletingId={deletingId}
              onOpen={openVideo}
              onDelete={deleteVideo}
            />
          ))}
        </Masonry>
      </div>

      <div ref={sentinelRef} className="h-1" />
      {loadingMore && (
        <div className="py-4 text-center text-gray-400">Загрузка...</div>
      )}

      {selected && (
        <VideoModal
          selected={selected}
          videos={videos}
          userId={userId}
          onClose={closeModal}
          onNavigate={(v) => {
            setSelected(v);
            window.history.replaceState({ videoId: v.id }, "", `/film/${v.id}`);
          }}
        />
      )}
    </>
  );
}
