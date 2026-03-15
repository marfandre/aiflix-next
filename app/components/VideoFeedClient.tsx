"use client";

import { useEffect, useState } from "react";
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
};

export default function VideoFeedClient({ userId, initialVideos, showAuthor = true, isOwnerView = false }: Props) {
  const [videos, setVideos] = useState<VideoRow[]>(initialVideos ?? []);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<VideoRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const supa = createClientComponentClient();

  // Load videos
  useEffect(() => {
    if (initialVideos && initialVideos.length > 0) {
      setVideos(initialVideos);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);

      const { data: filmsData, error } = await supa
        .from("films")
        .select("id, author_id, title, description, prompt, playback_id, created_at, model, aspect_ratio, genres, mood, colors, colors_preview, colors_full, colors_full_interval, color_mode, status")
        .order("created_at", { ascending: false })
        .limit(60);

      if (error) {
        console.error("video fetch error:", error);
        setVideos([]);
        setLoading(false);
        return;
      }

      if (!filmsData || filmsData.length === 0) {
        setVideos([]);
        setLoading(false);
        return;
      }

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

      const enrichedVideos: VideoRow[] = filmsData.map(f => ({
        ...f,
        profiles: f.author_id && profilesMap[f.author_id] ? profilesMap[f.author_id] : null,
      }));

      setVideos(enrichedVideos);
      setLoading(false);
    })();
  }, [supa, initialVideos]);

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
    window.history.pushState({ videoId: v.id }, "", `/film/${v.id}`);
  };

  const closeModal = () => {
    setSelected(null);
    window.history.pushState({}, "", window.location.pathname.startsWith("/film/") ? "/" : window.location.pathname + window.location.search);
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

      {selected && (
        <VideoModal
          selected={selected}
          userId={userId}
          onClose={closeModal}
        />
      )}
    </>
  );
}
