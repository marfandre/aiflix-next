"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import ImageCard from "./image-feed/ImageCard";
import ImageModal from "./image-feed/ImageModal";
import type { ImageRow, ImageVariant, SearchParams } from "./image-feed/types";
import { SHOW_PUBLIC_AUTHOR_IDENTITY } from "@/lib/publicIdentity";

// Responsive column count — совпадает со старым react-masonry-css конфигом
function colsForWidth(w: number): number {
  if (w <= 500) return 2;
  if (w <= 700) return 3;
  if (w <= 900) return 4;
  return 5;
}

// "16:9" → 16/9. Fallback = 1 (квадрат) при любой ошибке.
function parseAspectRatio(ar: string | null | undefined): number {
  if (!ar) return 1;
  const [w, h] = ar.split(/[:\/]/).map(Number);
  if (!w || !h) return 1;
  return w / h;
}

type Props = {
  userId: string | null;
  searchParams?: SearchParams;
  initialImages?: ImageRow[];
  showAuthor?: boolean;
  isOwnerView?: boolean;
  profileId?: string;
};

const PAGE_SIZE = 40;

export default function ImageFeedClient({ userId, searchParams = {}, initialImages, showAuthor = SHOW_PUBLIC_AUTHOR_IDENTITY, isOwnerView = false, profileId }: Props) {
  const [images, setImages] = useState<ImageRow[]>(initialImages ?? []);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [tagsMap, setTagsMap] = useState<Record<string, { ru: string; en: string }>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal state
  const [selected, setSelected] = useState<ImageRow | null>(null);
  const [variants, setVariants] = useState<ImageVariant[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);

  const supa = createClientComponentClient();
  const originalUrlRef = useRef<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // ---------- Кастомная masonry-раскладка ----------
  // SSR: 5 колонок (десктоп), на клиенте уточним через resize.
  const [colCount, setColCount] = useState<number>(5);
  useEffect(() => {
    const update = () => setColCount(colsForWidth(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // ---------- URL sync with modal ----------
  const pushImageUrl = useCallback((imageId: string) => {
    originalUrlRef.current = window.location.href;
    // Сохраняем текущие searchParams (особенно t=images), иначе в Next.js 14.1+
    // useSearchParams() в HomeContent сбросит tab на 'video' и размонтирует модалку
    const search = window.location.search;
    window.history.pushState({ imageModal: imageId }, "", `/images/${imageId}${search}`);
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

  // ---------- Режим витрины (главная без фильтров) ----------
  // Любой активный фильтр / поиск / страница профиля выключает курируемую ленту
  // и возвращает обычный фид по всей базе.
  const hasAnyFilter = !!(
    searchParams.colors ||
    searchParams.families ||
    searchParams.models ||
    searchParams.moods ||
    searchParams.imageTypes ||
    searchParams.tags ||
    searchParams.aspect
  );
  const isFeaturedMode = !profileId && !initialImages && !hasAnyFilter;

  // ---------- Ранжирование по color_families ----------
  const isColorSearch = !!searchParams.families;
  const familiesKey = searchParams.families ?? "";

  const rankByColorRelevance = useCallback((rows: ImageRow[]): ImageRow[] => {
    const fams = familiesKey.split(",").map((f) => f.trim().toLowerCase()).filter(Boolean);
    if (!fams.length) return rows;

    const POSITION_WEIGHT = [35, 25, 20, 12, 8]; // фолбэк-веса (≈площадь в %)

    // "Drain" neighbors — families specifically designed to catch false positives
    // of the requested family (e.g. mauve/peach were introduced to drain dirty
    // pinks). Asymmetric dominance: requested total must be >= each drain total,
    // otherwise the image is perceptually closer to that drain bucket and we drop it.
    // Non-drain neighbors (e.g. red vs pink) are NOT checked — they often coexist
    // legitimately (pink object on red scene), so dominance there would over-filter.
    const DRAIN_NEIGHBORS: Record<string, string[]> = {
      pink:   ['mauve', 'peach'],
      red:    ['brown', 'peach'],
      purple: ['mauve', 'indigo'],
      orange: ['peach', 'brown'],
    };

    // Union of drain neighbors for the requested families, minus the requested ones.
    const requestedSet = new Set(fams);
    const drains = new Set<string>();
    for (const f of fams) {
      for (const d of DRAIN_NEIGHBORS[f] ?? []) {
        if (!requestedSet.has(d)) drains.add(d);
      }
    }

    const scored = rows.map((img) => {
      const families: string[] = (img as any).color_families ?? [];
      const weights: number[] | null = (img as any).color_weights ?? null;
      const familyWeights: Array<Record<string, number>> | null =
        (img as any).color_family_weights ?? null;

      let score = 0;
      const totals: Record<string, number> = {};
      const colorCount = Math.max(families.length, familyWeights?.length ?? 0);
      // True if the requested family was the classifier's top-1 in at least one
      // slot — i.e. it's listed in color_families. In that case the classifier
      // already committed to "this is X" and we should not let soft probability
      // sums of drain neighbors veto it.
      const requestedIsTop1 = fams.some((f) => families.includes(f));

      for (let i = 0; i < colorCount && i < 5; i++) {
        const pixelWeight = weights?.[i] ?? POSITION_WEIGHT[i] ?? 5;

        if (familyWeights && familyWeights[i]) {
          // Sum probabilistic contributions across all slots. Also accumulate
          // per-family totals for the dominance check below.
          const fw = familyWeights[i];
          for (const [fam, prob] of Object.entries(fw)) {
            totals[fam] = (totals[fam] ?? 0) + pixelWeight * prob;
          }
          for (const f of fams) {
            const prob = fw[f] ?? 0;
            if (prob > 0) score += pixelWeight * prob;
          }
        } else if (fams.includes(families[i])) {
          // Legacy fallback: top-1 family match
          score += pixelWeight;
          totals[families[i]] = (totals[families[i]] ?? 0) + pixelWeight;
        }
      }

      // Asymmetric dominance: requested total must be >= the strongest drain
      // neighbor (mauve/peach for pink, etc). Non-drain neighbors are ignored.
      let maxDrain = 0;
      for (const d of drains) {
        if ((totals[d] ?? 0) > maxDrain) maxDrain = totals[d];
      }
      const requestedTotal = fams.reduce((acc, f) => acc + (totals[f] ?? 0), 0);

      // Share check: requested family must account for a minimum fraction of
      // the image's total color mass. Thresholds differ by family type:
      // "dominant" families (pink, red, orange, peach) occupy large areas when
      // truly present → higher threshold filters accent-only noise.
      // "ambient" families (indigo, blue, green, purple, mauve, etc.) often
      // appear as secondary colors at 12-17% → lower threshold avoids over-filtering.
      const totalMass = Object.values(totals).reduce((a, b) => a + b, 0);
      const share = totalMass > 0 ? requestedTotal / totalMass : 0;

      return { img, score, requestedTotal, maxDrain, share, requestedIsTop1 };
    });

    const SHARE_HIGH: Record<string, boolean> = {
      pink: true, red: true, orange: true, peach: true,
    };
    // Use the highest applicable threshold when searching multiple families.
    const shareMin = fams.some(f => SHARE_HIGH[f]) ? 0.18 : 0.10;

    const MIN_WEIGHT = 3;
    scored.sort((a, b) => b.score - a.score);
    return scored
      .filter((s) =>
        s.score >= MIN_WEIGHT &&
        (s.requestedIsTop1 || s.requestedTotal >= s.maxDrain) &&
        s.share >= shareMin
      )
      .map((s) => s.img);
  }, [familiesKey]);

  // ---------- Build query with filters ----------
  const buildQuery = useCallback((cursor?: string) => {
    // Для цветового поиска добавляем color_families в select для ранжирования.
    // Для витрины добавляем featured_priority — по нему делаем scatter.
    const selectFields: string = isColorSearch
      ? "id, user_id, path, title, description, prompt, created_at, colors, accent_colors, color_positions, model, aspect_ratio, tags, images_count, source, source_author, source_url, seed, color_families, color_weights, color_family_weights, profiles(username, avatar_url)"
      : isFeaturedMode
        ? "id, user_id, path, title, description, prompt, created_at, colors, accent_colors, color_families, color_positions, model, aspect_ratio, tags, images_count, source, source_author, source_url, seed, featured_priority, profiles(username, avatar_url)"
        : "id, user_id, path, title, description, prompt, created_at, colors, accent_colors, color_families, color_positions, model, aspect_ratio, tags, images_count, source, source_author, source_url, seed, profiles(username, avatar_url)";

    const pageLimit = isFeaturedMode
      ? 200
      : isColorSearch && !cursor
        ? 200
        : PAGE_SIZE;

    let query = supa
      .from("images_meta")
      .select(selectFields)
      .order("created_at", { ascending: false })
      .limit(pageLimit);

    if (cursor) query = query.lt("created_at", cursor);

    if (isFeaturedMode) {
      query = query.eq("is_featured", true);
    }

    if (searchParams.families) {
      const families = searchParams.families.split(",").map((f) => f.trim().toLowerCase()).filter(Boolean);
      if (families.length === 1) {
        query = query.contains("color_families", families);
      } else if (families.length > 1) {
        // OR: image must contain at least one of the requested families
        const orClauses = families.map((f) => `color_families.cs.{${f}}`).join(",");
        query = query.or(orClauses);
      }
    }

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

    if (searchParams.tags) {
      const tags = searchParams.tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (tags.length) query = query.contains("tags", tags);
    }

    if (searchParams.aspect) {
      query = query.eq("aspect_ratio", searchParams.aspect);
    }

    if (profileId) {
      query = query.eq("user_id", profileId);
    }

    return query;
  }, [supa, searchParams.colors, searchParams.families, searchParams.models, searchParams.tags, searchParams.aspect, isColorSearch, isFeaturedMode, profileId]);

  // ---------- Scatter для витрины: shuffle + priority наверху ----------
  // Fisher–Yates shuffle.
  const shuffleInPlace = useCallback(<T,>(arr: T[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }, []);

  // Рассыпаем priority-картинки по верху с шагом PRIORITY_STEP,
  // между ними — случайные обычные featured. Всё остальное хвостом.
  const scatterFeatured = useCallback((rows: ImageRow[]): ImageRow[] => {
    const priority = rows.filter((r) => ((r as any).featured_priority ?? 0) > 0);
    const rest = rows.filter((r) => ((r as any).featured_priority ?? 0) === 0);
    shuffleInPlace(priority);
    shuffleInPlace(rest);

    const PRIORITY_STEP = 3;
    const result: ImageRow[] = [];
    const topSlots = priority.length * PRIORITY_STEP;
    let pi = 0;
    let ri = 0;
    for (let i = 0; i < topSlots; i++) {
      if (i % PRIORITY_STEP === 0 && pi < priority.length) {
        result.push(priority[pi++]);
      } else if (ri < rest.length) {
        result.push(rest[ri++]);
      }
    }
    while (ri < rest.length) result.push(rest[ri++]);
    return result;
  }, [shuffleInPlace]);

  // ---------- Load feed (initial) ----------
  useEffect(() => {
    if (initialImages && initialImages.length > 0) {
      setImages(initialImages);
      setHasMore(initialImages.length >= PAGE_SIZE);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      const { data, error } = await buildQuery();
      if (error) {
        console.error("image fetch with filters:", error);
        setImages([]);
      } else {
        let rows = (data ?? []) as unknown as ImageRow[];
        if (isColorSearch) rows = rankByColorRelevance(rows);
        if (isFeaturedMode) rows = scatterFeatured(rows);
        setImages(rows);
        setHasMore(isColorSearch || isFeaturedMode ? false : rows.length >= PAGE_SIZE);
      }
      setLoading(false);
    })();
  }, [buildQuery, initialImages, isColorSearch, isFeaturedMode, rankByColorRelevance, scatterFeatured]);

  // ---------- Load more (infinite scroll) ----------
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const lastImage = images[images.length - 1];
    if (!lastImage?.created_at) return;

    setLoadingMore(true);
    const { data, error } = await buildQuery(lastImage.created_at);
    if (error) {
      console.error("image fetch more:", error);
    } else {
      const rows = (data ?? []) as unknown as ImageRow[];
      setImages((prev) => [...prev, ...rows]);
      setHasMore(rows.length >= PAGE_SIZE);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, images, buildQuery]);

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

  // ---------- Realtime subscription ----------
  useEffect(() => {
    if (isFeaturedMode) return;
    if (searchParams.colors || searchParams.families || searchParams.models || searchParams.tags || searchParams.aspect) return;

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
  }, [supa, isFeaturedMode, searchParams.colors, searchParams.families, searchParams.models, searchParams.tags, searchParams.aspect]);

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
        .select("id, user_id, path, title, description, prompt, created_at, colors, accent_colors, color_families, color_positions, model, aspect_ratio, tags, images_count, source, source_author, source_url, seed, profiles(username, avatar_url)")
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
    if (!confirm('Удалить эту картинку?')) return;
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
        alert('Ошибка при удалении: ' + (data.error || 'Неизвестная ошибка'));
      } else {
        setImages(prev => prev.filter(im => im.id !== imageId));
      }
    } finally {
      setDeletingId(null);
    }
  };

  // ---------- Shortest-column-first packing ----------
  // Вместо round-robin (react-masonry-css) раскладываем каждую карточку
  // в самую низкую на данный момент колонку, используя aspect_ratio из БД
  // как прокси высоты. Колонки в итоге выравниваются гораздо плотнее.
  const columnsLayout = useMemo(() => {
    const cols: ImageRow[][] = Array.from({ length: colCount }, () => []);
    const heights = new Array(colCount).fill(0);
    for (const img of images) {
      // Ограничиваем клампом, т.к. ImageCard стягивает картинку в [180, 500]px.
      const raw = 1 / parseAspectRatio((img as any).aspect_ratio);
      const relH = Math.max(0.45, Math.min(1.8, raw));
      let minIdx = 0;
      for (let i = 1; i < colCount; i++) {
        if (heights[i] < heights[minIdx]) minIdx = i;
      }
      cols[minIdx].push(img);
      heights[minIdx] += relH;
    }
    return cols;
  }, [images, colCount]);

  const feedEnded = !hasMore && !loading && images.length > 0;

  if (loading) return <div className="py-6 text-gray-500">{"Загрузка..."}</div>;
  if (images.length === 0) return <div className="py-6 text-gray-500">{"Ничего не найдено"}</div>;

  return (
    <>
      {/* Custom masonry grid */}
      <div
        className="relative overflow-hidden rounded-2xl w-full"
        style={
          feedEnded
            ? {
                // Мягко растворяем последние ~120px общей высоты — маскирует
                // остаточную неровность колонок после packing.
                WebkitMaskImage:
                  "linear-gradient(to bottom, black 0%, black calc(100% - 120px), transparent 100%)",
                maskImage:
                  "linear-gradient(to bottom, black 0%, black calc(100% - 120px), transparent 100%)",
              }
            : undefined
        }
      >
        <div className="flex gap-1 w-full">
          {columnsLayout.map((col, ci) => (
            <div key={ci} className="flex-1 min-w-0 flex flex-col">
              {col.map((im) => (
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
            </div>
          ))}
        </div>
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />
      {loadingMore && (
        <div className="flex justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
        </div>
      )}

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
