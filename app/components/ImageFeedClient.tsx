"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Masonry from "react-masonry-css";
import ImageCard from "./image-feed/ImageCard";
import ImageModal from "./image-feed/ImageModal";
import type { ImageRow, ImageVariant, SearchParams } from "./image-feed/types";

type Props = {
  userId: string | null;
  searchParams?: SearchParams;
  initialImages?: ImageRow[];
  showAuthor?: boolean;
  isOwnerView?: boolean;
};

export default function ImageFeedClient({ userId, searchParams = {}, initialImages, showAuthor = true, isOwnerView = false }: Props) {
  const [images, setImages] = useState<ImageRow[]>(initialImages ?? []);
  const [loading, setLoading] = useState(true);
  const [tagsMap, setTagsMap] = useState<Record<string, { ru: string; en: string }>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal state
  const [selected, setSelected] = useState<ImageRow | null>(null);
  const [variants, setVariants] = useState<ImageVariant[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);

  const supa = createClientComponentClient();
  const originalUrlRef = useRef<string | null>(null);

  // ---------- URL sync with modal ----------
  const pushImageUrl = useCallback((imageId: string) => {
    originalUrlRef.current = window.location.href;
    window.history.pushState({ imageModal: imageId }, "", `/images/${imageId}`);
  }, []);

  const restoreUrl = useCallback(() => {
    if (originalUrlRef.current) {
      window.history.pushState(null, "", originalUrlRef.current);
      originalUrlRef.current = null;
    }
  }, []);

  // Close modal on browser back button
  useEffect(() => {
    const handlePopState = () => {
      if (selected) {
        originalUrlRef.current = null;
        setSelected(null);
        setVariants([]);
        setVariantsLoading(false);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selected]);

  // Load tags map
  useEffect(() => {
    fetch('/api/tags')
      .then(r => r.json())
      .then(data => {
        const map: Record<string, { ru: string; en: string }> = {};
        for (const t of data.all ?? []) {
          map[t.id] = { ru: t.name_ru, en: t.name_en };
        }
        setTagsMap(map);
      })
      .catch(() => { });
  }, []);

  // ---------- Load feed with filters ----------
  useEffect(() => {
    if (initialImages && initialImages.length > 0) {
      setImages(initialImages);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);

      let query = supa
        .from("images_meta")
        .select(
          "id, user_id, path, title, description, prompt, created_at, colors, accent_colors, color_positions, model, aspect_ratio, tags, images_count, profiles(username, avatar_url)"
        )
        .order("created_at", { ascending: false })
        .limit(60);

      if (searchParams.colors) {
        const colors = searchParams.colors.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
        if (colors.length) query = query.contains("colors", colors);
      }

      if (searchParams.models) {
        const models = searchParams.models.split(",").map((m) => m.trim().toLowerCase()).filter(Boolean);
        if (models.length) {
          const orClause = models.map((m) => `model.ilike.%${m}%`).join(",");
          query = query.or(orClause);
        }
      }

      const { data, error } = await query;
      if (error) {
        console.error("image fetch with filters:", error);
        setImages([]);
      } else {
        setImages((data ?? []) as ImageRow[]);
      }
      setLoading(false);
    })();
  }, [supa, searchParams.colors, searchParams.models, initialImages]);

  // ---------- Realtime subscription ----------
  useEffect(() => {
    if (searchParams.colors || searchParams.models) return;

    const channel = supa
      .channel("images-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "images_meta" }, async (payload) => {
        const newImage = payload.new as ImageRow;
        if (newImage.user_id) {
          const { data: profileData } = await supa
            .from("profiles")
            .select("username, avatar_url")
            .eq("id", newImage.user_id)
            .maybeSingle();
          const enriched: ImageRow = {
            ...newImage,
            profiles: profileData ? [{ username: profileData.username, avatar_url: profileData.avatar_url }] : [],
          };
          setImages((prev) => [enriched, ...prev]);
        } else {
          setImages((prev) => [newImage, ...prev]);
        }
      })
      .subscribe();

    return () => { supa.removeChannel(channel); };
  }, [supa, searchParams.colors, searchParams.models]);

  const publicImageUrl = (path: string) => {
    const { data } = supa.storage.from("images").getPublicUrl(path);
    return data.publicUrl;
  };

  // ---------- Open modal + load variants ----------
  const openImage = async (im: ImageRow) => {
    const fallbackVariant: ImageVariant = { path: im.path, colors: im.colors ?? null, order_index: 0 };

    setSelected(im);
    setVariants([fallbackVariant]);
    setVariantsLoading(true);
    pushImageUrl(im.id);

    try {
      const { data: freshData, error: freshError } = await supa
        .from("images_meta")
        .select("id, user_id, path, title, description, prompt, created_at, colors, accent_colors, color_positions, model, aspect_ratio, tags, images_count, profiles(username, avatar_url)")
        .eq("id", im.id)
        .single();

      if (!freshError && freshData) {
        setSelected(freshData as ImageRow);
        setImages(prev => prev.map(img => img.id === im.id ? (freshData as ImageRow) : img));
      }

      const { data, error } = await supa
        .from("image_variants")
        .select("path, colors, order_index")
        .eq("image_meta_id", im.id)
        .order("order_index", { ascending: true });

      if (error) {
        console.error("load image_variants error:", error);
        setVariants([fallbackVariant]);
      } else if (data && data.length) {
        setVariants((data as ImageVariant[]).map((v) => ({ path: v.path, colors: v.colors ?? null, order_index: v.order_index ?? 0 })));
      } else {
        setVariants([fallbackVariant]);
      }
    } finally {
      setVariantsLoading(false);
    }
  };

  const closeModal = () => {
    restoreUrl();
    setSelected(null);
    setVariants([]);
    setVariantsLoading(false);
  };

  const deleteImage = async (imageId: string, imagePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u044D\u0442\u0443 \u043A\u0430\u0440\u0442\u0438\u043D\u043A\u0443?')) return;
    setDeletingId(imageId);
    try {
      const res = await fetch('/api/images/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: imagePath }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('Delete error:', data.error);
        alert('\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u0438: ' + (data.error || '\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430'));
      } else {
        setImages(prev => prev.filter(im => im.id !== imageId));
      }
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="py-6 text-gray-500">{"\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..."}</div>;
  if (images.length === 0) return <div className="py-6 text-gray-500">{"\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E"}</div>;

  return (
    <>
      {/* Masonry grid */}
      <div className="overflow-hidden rounded-2xl w-full">
        <Masonry
          breakpointCols={{ default: 5, 1100: 5, 900: 4, 700: 3, 500: 2 }}
          className="flex -ml-1 w-auto"
          columnClassName="pl-1 bg-clip-padding"
        >
          {images.map((im) => (
            <ImageCard
              key={im.id}
              image={im}
              userId={userId}
              showAuthor={showAuthor}
              isOwnerView={isOwnerView}
              deletingId={deletingId}
              publicImageUrl={publicImageUrl}
              onOpen={openImage}
              onDelete={deleteImage}
            />
          ))}
        </Masonry>
      </div>

      {/* Modal */}
      {selected && (
        <ImageModal
          selected={selected}
          variants={variants}
          variantsLoading={variantsLoading}
          tagsMap={tagsMap}
          userId={userId}
          publicImageUrl={publicImageUrl}
          onClose={closeModal}
          images={images}
          onNavigate={openImage}
        />
      )}
    </>
  );
}
