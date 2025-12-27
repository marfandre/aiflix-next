"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import LikeButton from "./LikeButton";

type SearchParams = {
  colors?: string;
  models?: string;
  moods?: string;
  imageTypes?: string;
};

type Props = {
  userId: string | null;
  searchParams?: SearchParams;
};

type ImageRow = {
  id: string;
  user_id: string | null;
  path: string;
  title: string | null;
  description?: string | null;
  prompt?: string | null;
  created_at: string | null;
  colors: string[] | null;
  model?: string | null;
  tags?: string[] | null;
  images_count?: number | null;
  profiles:
  | { username: string | null; avatar_url: string | null }[]
  | { username: string | null; avatar_url: string | null }
  | null;
};

type ImageVariant = {
  path: string;
  colors: string[] | null;
  order_index: number | null;
};

/** Красивые подписи для моделей */
const MODEL_LABELS: Record<string, string> = {
  sora: "Sora",
  midjourney: "MidJourney",
  "stable diffusion xl": "Stable Diffusion XL",
  "stable diffusion 3": "Stable Diffusion 3",
  sdxl: "SDXL",
  pika: "Pika",
  runway: "Runway",
  flux: "Flux",
  dalle: "DALL·E",
  "dalle 3": "DALL·E 3",
  "dall-e": "DALL·E",
  "dall-e 3": "DALL·E 3",
  kandinsky: "Kandinsky",
  leonardo: "Leonardo",
};

function formatModelName(raw?: string | null): string {
  if (!raw) return "не указана";
  const key = raw.toLowerCase();
  return MODEL_LABELS[key] ?? raw;
}

export default function ImageFeedClient({ userId, searchParams = {} }: Props) {
  const [images, setImages] = useState<ImageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagsMap, setTagsMap] = useState<Record<string, { ru: string; en: string }>>({}); // id -> {ru, en}

  const [selected, setSelected] = useState<ImageRow | null>(null);
  const [variants, setVariants] = useState<ImageVariant[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [expandedChartId, setExpandedChartId] = useState<string | null>(null);
  const [imageWidth, setImageWidth] = useState<number | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  const supa = createClientComponentClient();

  // Загрузка тегов для маппинга id -> {ru, en}
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

  // ---------- ЗАГРУЗКА ЛЕНТЫ С ФИЛЬТРАМИ ----------
  useEffect(() => {
    (async () => {
      setLoading(true);

      let query = supa
        .from("images_meta")
        .select(
          "id, user_id, path, title, description, prompt, created_at, colors, model, tags, images_count, profiles(username, avatar_url)"
        )
        .order("created_at", { ascending: false })
        .limit(60);

      // цвета
      if (searchParams.colors) {
        const colors = searchParams.colors
          .split(",")
          .map((c) => c.trim().toLowerCase())
          .filter(Boolean);
        if (colors.length) query = query.contains("colors", colors);
      }

      // МОДЕЛИ — теперь через ILIKE, а не IN
      if (searchParams.models) {
        const models = searchParams.models
          .split(",")
          .map((m) => m.trim().toLowerCase())
          .filter(Boolean);

        if (models.length) {
          // пример строки: "model.ilike.%dalle%,model.ilike.%midjourney%"
          const orClause = models
            .map((m) => `model.ilike.%${m}%`)
            .join(",");
          query = query.or(orClause);
        }
      }

      // теги (заменили mood и image_type)
      // Фильтрация по тегам не поддерживается в этом компоненте напрямую
      // (используйте поиск через SearchButton)

      const { data, error } = await query;

      if (error) {
        console.error("image fetch with filters:", error);
        setImages([]);
      } else {
        setImages((data ?? []) as ImageRow[]);
      }

      setLoading(false);
    })();
  }, [
    supa,
    searchParams.colors,
    searchParams.models,
  ]);

  // ---------- ПОДПИСКА НА НОВЫЕ КАРТИНКИ (без фильтров) ----------
  useEffect(() => {
    if (
      searchParams.colors ||
      searchParams.models
    )
      return;

    const channel = supa
      .channel("images-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "images_meta",
        },
        async (payload) => {
          const newImage = payload.new as ImageRow;

          if (newImage.user_id) {
            const { data: profileData } = await supa
              .from("profiles")
              .select("username, avatar_url")
              .eq("id", newImage.user_id)
              .maybeSingle();

            const enriched: ImageRow = {
              ...newImage,
              profiles: profileData
                ? [
                  {
                    username: profileData.username,
                    avatar_url: profileData.avatar_url,
                  },
                ]
                : [],
            };

            setImages((prev) => [enriched, ...prev]);
          } else {
            setImages((prev) => [newImage, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supa.removeChannel(channel);
    };
  }, [
    supa,
    searchParams.colors,
    searchParams.models,
  ]);

  const publicImageUrl = (path: string) => {
    const { data } = supa.storage.from("images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleCopyPrompt = async () => {
    const text = selected?.prompt || selected?.description;
    if (!text) return;
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) return;
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error("copy prompt error", e);
    }
  };

  // ---------- ОТКРЫТИЕ МОДАЛКИ + ЗАГРУЗКА ВАРИАНТОВ ----------
  const openImage = async (im: ImageRow) => {
    const fallbackVariant: ImageVariant = {
      path: im.path,
      colors: im.colors ?? null,
      order_index: 0,
    };

    setSelected(im);
    setSlideIndex(0);
    setVariants([fallbackVariant]);
    setVariantsLoading(true);
    setImageWidth(null);

    try {
      const { data, error } = await supa
        .from("image_variants")
        .select("path, colors, order_index")
        .eq("image_meta_id", im.id)
        .order("order_index", { ascending: true });

      if (error) {
        console.error("load image_variants error:", error);
        setVariants([fallbackVariant]);
      } else if (data && data.length) {
        setVariants(
          (data as ImageVariant[]).map((v) => ({
            path: v.path,
            colors: v.colors ?? null,
            order_index: v.order_index ?? 0,
          }))
        );
      } else {
        setVariants([fallbackVariant]);
      }
    } finally {
      setVariantsLoading(false);
    }
  };

  const closeModal = () => {
    setSelected(null);
    setVariants([]);
    setSlideIndex(0);
    setVariantsLoading(false);
    setShowPrompt(false);
  };

  if (loading) return <div className="py-6 text-gray-500">Загрузка...</div>;
  if (images.length === 0)
    return <div className="py-6 text-gray-500">Ничего не найдено</div>;

  const currentVariant: ImageVariant | null =
    selected && variants.length
      ? variants[slideIndex] ?? variants[0]
      : null;

  const currentColors =
    currentVariant?.colors && currentVariant.colors.length
      ? currentVariant.colors
      : selected?.colors ?? [];

  const hasCarousel = !variantsLoading && variants.length > 1;

  return (
    <>
      {/* СЕТКА ЛЕНТЫ — Lexica-стиль */}
      <div className="overflow-hidden rounded-2xl">
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {images.map((im) => {
            const p = Array.isArray(im.profiles) ? im.profiles[0] : im.profiles;
            const nick: string = p?.username ?? "user";
            const avatar: string | null = p?.avatar_url ?? null;
            const url = publicImageUrl(im.path);
            const title = (im.title ?? "").trim() || "Картинка";
            const imagesCount =
              typeof im.images_count === "number" ? im.images_count : 1;
            const showCarouselBadge = imagesCount > 1;

            return (
              <div
                key={im.id}
                className="group relative"
              >
                <button
                  type="button"
                  onClick={() => openImage(im)}
                  className="relative block aspect-[4/5] w-full bg-gray-100"
                >
                  <img
                    src={url}
                    alt={title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                  {/* Счётчик изображений (всегда виден) */}
                  {showCarouselBadge && (
                    <div className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
                      {imagesCount}
                    </div>
                  )}

                  {/* Круговая диаграмма цветов (всегда видна, кликабельна) */}
                  {im.colors && im.colors.length > 0 && (() => {
                    const colors = im.colors.slice(0, 5);
                    const segmentAngle = 360 / colors.length;
                    const isExpanded = expandedChartId === im.id;
                    const size = isExpanded ? 64 : 20;
                    const radius = size / 2;
                    const cx = radius;
                    const cy = radius;

                    // Функция для создания пути сегмента
                    const createSegmentPath = (startAngle: number, endAngle: number) => {
                      const startRad = (startAngle - 90) * Math.PI / 180;
                      const endRad = (endAngle - 90) * Math.PI / 180;
                      const x1 = cx + radius * Math.cos(startRad);
                      const y1 = cy + radius * Math.sin(startRad);
                      const x2 = cx + radius * Math.cos(endRad);
                      const y2 = cy + radius * Math.sin(endRad);
                      const largeArc = endAngle - startAngle > 180 ? 1 : 0;
                      return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                    };

                    return (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedChartId(isExpanded ? null : im.id);
                        }}
                        className={`absolute rounded-full z-10 transition-all duration-300 cursor-pointer ${isExpanded ? 'bottom-2 right-2' : 'bottom-2 right-2'}`}
                        style={{
                          width: size,
                          height: size,
                          boxShadow: isExpanded
                            ? '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 3px rgba(255,255,255,0.3)'
                            : '0 1px 3px rgba(0,0,0,0.3)'
                        }}
                        title={`Нажмите чтобы ${isExpanded ? 'свернуть' : 'увеличить'}`}
                      >
                        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-full overflow-hidden">
                          {isExpanded && (
                            <defs>
                              {/* Глянцевый градиент — только для увеличенного режима */}
                              <linearGradient id={`gloss-${im.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
                                <stop offset="40%" stopColor="rgba(255,255,255,0.1)" />
                                <stop offset="60%" stopColor="rgba(0,0,0,0)" />
                                <stop offset="100%" stopColor="rgba(0,0,0,0.15)" />
                              </linearGradient>
                              {/* Маска для круга */}
                              <clipPath id={`clip-${im.id}`}>
                                <circle cx={radius} cy={radius} r={radius} />
                              </clipPath>
                            </defs>
                          )}

                          {/* Сегменты */}
                          {isExpanded ? (
                            <g clipPath={`url(#clip-${im.id})`}>
                              {colors.map((color, i) => (
                                <path
                                  key={i}
                                  d={createSegmentPath(i * segmentAngle, (i + 1) * segmentAngle)}
                                  fill={color}
                                />
                              ))}
                              {/* Глянцевый оверлей */}
                              <circle cx={radius} cy={radius} r={radius} fill={`url(#gloss-${im.id})`} />
                            </g>
                          ) : (
                            // Плоский стиль для маленькой кнопки
                            colors.map((color, i) => (
                              <path
                                key={i}
                                d={createSegmentPath(i * segmentAngle, (i + 1) * segmentAngle)}
                                fill={color}
                              />
                            ))
                          )}

                          {/* Обводка */}
                          <circle
                            cx={radius}
                            cy={radius}
                            r={radius - 0.5}
                            fill="none"
                            stroke={isExpanded ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.5)"}
                            strokeWidth={1}
                          />
                        </svg>
                      </button>
                    );
                  })()}

                  {/* Инфо при наведении */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <Link
                      href={`/u/${encodeURIComponent(nick)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="pointer-events-auto flex items-center gap-1.5 rounded-full px-2 py-1 text-white transition hover:bg-white/20"
                    >
                      {avatar && (
                        <img
                          src={avatar}
                          alt={nick}
                          className="h-[18px] w-[18px] shrink-0 rounded-full object-cover ring-1 ring-white/40"
                        />
                      )}
                      <span className="truncate text-[11px] font-medium drop-shadow-md">{nick}</span>
                    </Link>
                  </div>

                  {/* Кнопка лайка при наведении (по центру сверху) */}
                  <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                      <LikeButton
                        target="image"
                        id={im.id}
                        userId={userId}
                        ownerId={im.user_id}
                        className="text-white drop-shadow-md"
                      />
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {/* МОДАЛКА С КАРТИНКОЙ */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={closeModal}
        >
          {/* Flex контейнер для кружков + модалки */}
          <div className="flex items-center gap-3">
            {/* Цветовая палитра — слева от модалки */}
            {Array.isArray(currentColors) && currentColors.length > 0 && (
              <div className="flex-col gap-2 hidden sm:flex">
                {currentColors.map((c, index) => {
                  if (!c) return null;
                  return (
                    <div
                      key={c + index}
                      className="rounded-full border-2 border-white/30 shadow-lg"
                      style={{
                        backgroundColor: c,
                        width: 28,
                        height: 28,
                      }}
                      title={c}
                    />
                  );
                })}
              </div>
            )}

            <div
              className="relative flex max-h-[90vh] w-auto max-w-[95vw] flex-col overflow-hidden rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Картинка с overlay */}
              <div className="relative flex items-center justify-center bg-black">
                {currentVariant ? (
                  <>
                    <img
                      ref={imageRef}
                      src={publicImageUrl(currentVariant.path)}
                      alt={(selected.title ?? "").trim() || "Картинка"}
                      className="max-h-[90vh] w-auto max-w-full object-contain"
                      onLoad={() => {
                        if (imageRef.current) {
                          setImageWidth(imageRef.current.offsetWidth);
                        }
                      }}
                    />

                    {hasCarousel && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setSlideIndex(
                              (i) =>
                                (i - 1 + variants.length) % variants.length
                            )
                          }
                          className="group absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 shadow-sm backdrop-blur-sm hover:bg-black/60"
                          title="Предыдущее изображение"
                        >
                          <span className="block text-lg leading-none text-white transition-transform group-hover:-translate-x-0.5">
                            ‹
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setSlideIndex((i) => (i + 1) % variants.length)
                          }
                          className="group absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 shadow-sm backdrop-blur-sm hover:bg-black/60"
                        >
                          <span className="block text-lg leading-none text-white transition-transform group-hover:translate-x-0.5">
                            ›
                          </span>
                        </button>

                        <div className="absolute bottom-20 left-1/2 flex -translate-x-1/2 gap-1">
                          {variants.map((v, idx) => (
                            <button
                              key={v.path + idx}
                              type="button"
                              onClick={() => setSlideIndex(idx)}
                              className={`h-1.5 w-1.5 rounded-full ${idx === slideIndex
                                ? "bg-white"
                                : "bg-white/40"
                                }`}
                            />
                          ))}
                        </div>
                      </>
                    )}

                    {/* Всплывающее окно с промтом */}
                    {showPrompt && (
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-10"
                        onClick={() => setShowPrompt(false)}
                      >
                        <div
                          className="max-w-[90%] max-h-[80%] overflow-auto rounded-xl bg-white/15 backdrop-blur-md p-6 border border-white/30"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between gap-4 mb-4">
                            <h3 className="text-white font-medium">Промт</h3>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleCopyPrompt}
                                disabled={!selected.prompt && !selected.description}
                                className="rounded-full bg-white/20 p-2 hover:bg-white/30 disabled:opacity-40 text-white"
                                title="Скопировать промт"
                              >
                                <svg
                                  aria-hidden="true"
                                  viewBox="0 0 24 24"
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <rect x="9" y="9" width="11" height="11" rx="2" />
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowPrompt(false)}
                                className="rounded-full bg-white/20 p-2 hover:bg-white/30 text-white"
                                title="Закрыть"
                              >
                                <svg
                                  aria-hidden="true"
                                  viewBox="0 0 24 24"
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                            {selected.prompt || selected.description || "Промт не указан"}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Оптическое стекло effect */}
                    <div className="absolute bottom-0 left-0 right-0 bg-white/15 backdrop-blur-sm backdrop-brightness-110 backdrop-contrast-125 p-4 border-t border-white/30">
                      <div className="flex flex-wrap items-center gap-3 text-xs text-white/80">

                        {/* Кнопка Промт */}
                        <button
                          type="button"
                          onClick={() => setShowPrompt(true)}
                          className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 transition hover:bg-white/30 text-white"
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                          </svg>
                          Промт
                        </button>

                        {/* Модель */}
                        <span>
                          {formatModelName(selected.model)}
                        </span>

                        {(() => {
                          const p = Array.isArray(selected.profiles)
                            ? selected.profiles[0]
                            : selected.profiles;
                          const nick: string = p?.username ?? "user";
                          const avatar: string | null = p?.avatar_url ?? null;
                          return (
                            <Link
                              href={`/u/${encodeURIComponent(nick)}`}
                              className="flex items-center gap-1.5 rounded-full bg-white/20 px-2 py-0.5 transition hover:bg-white/30"
                            >
                              {avatar && (
                                <img
                                  src={avatar}
                                  alt={nick}
                                  className="h-4 w-4 rounded-full object-cover ring-1 ring-white/40"
                                />
                              )}
                              <span className="text-white">{nick}</span>
                            </Link>
                          );
                        })()}

                        {selected.created_at && (
                          <span className="text-white/60">
                            {new Date(selected.created_at).toLocaleDateString("ru-RU")}
                          </span>
                        )}

                        {/* Теги inline */}
                        {selected.tags && selected.tags.length > 0 && (
                          <>
                            {selected.tags.slice(0, 3).map((tagWithLang) => {
                              let tagId = tagWithLang;
                              let lang: 'ru' | 'en' = 'ru';
                              if (tagWithLang.endsWith(':en')) {
                                tagId = tagWithLang.slice(0, -3);
                                lang = 'en';
                              } else if (tagWithLang.endsWith(':ru')) {
                                tagId = tagWithLang.slice(0, -3);
                                lang = 'ru';
                              }
                              const tagNames = tagsMap[tagId];
                              const displayName = tagNames ? tagNames[lang] : tagId;

                              return (
                                <span
                                  key={tagWithLang}
                                  className="rounded-full bg-white/20 px-2 py-0.5"
                                >
                                  {displayName}
                                </span>
                              );
                            })}
                            {selected.tags.length > 3 && (
                              <span className="text-white/60">+{selected.tags.length - 3}</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-white/60 p-8">
                    Не удалось загрузить изображение.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
