"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Masonry from "react-masonry-css";
import LikeButton from "./LikeButton";
import PromptModal from "./PromptModal";

type SearchParams = {
  colors?: string;
  models?: string;
  moods?: string;
  imageTypes?: string;
};

type Props = {
  userId: string | null;
  searchParams?: SearchParams;
  initialImages?: ImageRow[];  // Для использования в профиле (пропускает загрузку из БД)
  showAuthor?: boolean;        // Показывать ли аватар автора (по умолчанию true)
  isOwnerView?: boolean;       // Труе если это профиль владельца (показывает редактирование/удаление)
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
  accent_colors?: string[] | null;  // Акцентные цвета
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
  "stable-diffusion-xl": "Stable Diffusion XL",
  "stable diffusion 3": "Stable Diffusion 3",
  "stable-diffusion-3": "Stable Diffusion 3",
  sdxl: "SDXL",
  pika: "Pika",
  runway: "Runway",
  flux: "Flux",
  dalle: "DALL·E",
  "dalle 3": "DALL·E 3",
  "dalle-3": "DALL·E 3",
  "dall-e": "DALL·E",
  "dall-e 3": "DALL·E 3",
  "dall-e-3": "DALL·E 3",
  kandinsky: "Kandinsky",
  leonardo: "Leonardo",
  ideogram: "Ideogram",
  playground: "Playground",
  krea: "KREA",
};

function formatModelName(raw?: string | null): string {
  if (!raw) return "не указана";
  const key = raw.toLowerCase();
  return MODEL_LABELS[key] ?? raw;
}

/** Форматирует дату в формате "DEC 25" (месяц + год) */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const year = date.getFullYear().toString().slice(-2);
  return `${month} ${year}`;
}

export default function ImageFeedClient({ userId, searchParams = {}, initialImages, showAuthor = true, isOwnerView = false }: Props) {
  const [images, setImages] = useState<ImageRow[]>(initialImages ?? []);
  const [loading, setLoading] = useState(true);
  const [tagsMap, setTagsMap] = useState<Record<string, { ru: string; en: string }>>({}); // id -> {ru, en}
  const [deletingId, setDeletingId] = useState<string | null>(null); // Для анимации удаления

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

  // ---------- ЗАГРУЗКА ЛЕНТЫ С ФИЛЬТРАМИ (пропускается если передан initialImages) ----------
  useEffect(() => {
    // Если переданы начальные картинки — пропускаем загрузку из БД
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
          "id, user_id, path, title, description, prompt, created_at, colors, accent_colors, model, tags, images_count, profiles(username, avatar_url)"
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
    initialImages,
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

  // ---------- ОТКРЫТИЕ МОДАЛКИ + ЗАГРУЗКА ВАРИАНТОВ ----------
  const openImage = async (im: ImageRow) => {
    const fallbackVariant: ImageVariant = {
      path: im.path,
      colors: im.colors ?? null,
      order_index: 0,
    };

    // Сначала показываем модалку с текущими данными
    setSelected(im);
    setSlideIndex(0);
    setVariants([fallbackVariant]);
    setVariantsLoading(true);
    setImageWidth(null);

    try {
      // Подгружаем свежие данные изображения из БД
      const { data: freshData, error: freshError } = await supa
        .from("images_meta")
        .select("id, user_id, path, title, description, prompt, created_at, colors, accent_colors, model, tags, images_count, profiles(username, avatar_url)")
        .eq("id", im.id)
        .single();

      if (!freshError && freshData) {
        // Обновляем selected с свежими данными
        setSelected(freshData as ImageRow);
        // Также обновляем в общем списке для консистентности
        setImages(prev => prev.map(img => img.id === im.id ? (freshData as ImageRow) : img));
      }

      // Загружаем варианты
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

  // Удаление картинки
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
        // Удаляем из локального состояния
        setImages(prev => prev.filter(im => im.id !== imageId));
      }
    } finally {
      setDeletingId(null);
    }
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
      {/* СЕТКА ЛЕНТЫ — Masonry стиль */}
      <div className="overflow-hidden rounded-2xl w-full">
        <Masonry
          breakpointCols={{
            default: 5,
            1100: 5,
            900: 4,
            700: 3,
            500: 2
          }}
          className="flex -ml-3 w-auto"
          columnClassName="pl-3 bg-clip-padding"
        >
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
                className="group relative mb-3"
              >
                <button
                  type="button"
                  onClick={() => openImage(im)}
                  className="relative block w-full overflow-hidden bg-gray-100"
                  style={{
                    aspectRatio: 'auto',
                    minHeight: '0',
                    maxHeight: '500px'
                  }}
                >
                  <img
                    src={url}
                    alt={title}
                    className="w-full h-full transition-transform duration-300 group-hover:scale-105"
                    style={{
                      objectFit: 'cover',
                      objectPosition: 'center',
                      minHeight: '180px',
                      maxHeight: '500px'
                    }}
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
                    const accentColors = (im.accent_colors ?? []).filter(c => c && c.trim() !== '').slice(0, 3);
                    const hasAccents = accentColors.length > 0;
                    const segmentAngle = 360 / colors.length;
                    const isExpanded = expandedChartId === im.id;

                    // Размеры с учётом акцентного кольца и зазора
                    const ringWidth = isExpanded ? 3.4 : 1.7; // толщина акцентного кольца
                    const gap = isExpanded ? 2 : 1; // зазор между кругом и кольцом
                    const baseSize = isExpanded ? 64 : 20;
                    const size = hasAccents ? baseSize + (ringWidth + gap) * 2 : baseSize;
                    const outerRadius = size / 2;
                    const accentInnerRadius = hasAccents ? outerRadius - ringWidth : outerRadius; // внутренний радиус акцентного кольца
                    const innerRadius = hasAccents ? accentInnerRadius - gap : outerRadius; // радиус основного круга
                    const cx = outerRadius;
                    const cy = outerRadius;

                    // Функция для создания пути сегмента (для основных цветов)
                    const createSegmentPath = (startAngle: number, endAngle: number, r: number) => {
                      const startRad = (startAngle - 90) * Math.PI / 180;
                      const endRad = (endAngle - 90) * Math.PI / 180;
                      const x1 = cx + r * Math.cos(startRad);
                      const y1 = cy + r * Math.sin(startRad);
                      const x2 = cx + r * Math.cos(endRad);
                      const y2 = cy + r * Math.sin(endRad);
                      const largeArc = endAngle - startAngle > 180 ? 1 : 0;
                      return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                    };

                    // Функция для создания пути кольцевого сегмента (для акцентов)
                    const createRingSegmentPath = (startAngle: number, endAngle: number, rOuter: number, rInner: number) => {
                      const startRad = (startAngle - 90) * Math.PI / 180;
                      const endRad = (endAngle - 90) * Math.PI / 180;
                      const x1Outer = cx + rOuter * Math.cos(startRad);
                      const y1Outer = cy + rOuter * Math.sin(startRad);
                      const x2Outer = cx + rOuter * Math.cos(endRad);
                      const y2Outer = cy + rOuter * Math.sin(endRad);
                      const x1Inner = cx + rInner * Math.cos(startRad);
                      const y1Inner = cy + rInner * Math.sin(startRad);
                      const x2Inner = cx + rInner * Math.cos(endRad);
                      const y2Inner = cy + rInner * Math.sin(endRad);
                      const largeArc = endAngle - startAngle > 180 ? 1 : 0;
                      return `M ${x1Outer} ${y1Outer} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2Outer} ${y2Outer} L ${x2Inner} ${y2Inner} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x1Inner} ${y1Inner} Z`;
                    };

                    const accentSegmentAngle = accentColors.length > 0 ? 360 / accentColors.length : 360;

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
                              {/* Маска для внутреннего круга */}
                              <clipPath id={`clip-inner-${im.id}`}>
                                <circle cx={cx} cy={cy} r={innerRadius} />
                              </clipPath>
                            </defs>
                          )}

                          {/* Акцентное кольцо (внешнее) */}
                          {hasAccents && accentColors.map((color, i) => (
                            <path
                              key={`accent-${i}`}
                              d={createRingSegmentPath(
                                i * accentSegmentAngle,
                                (i + 1) * accentSegmentAngle,
                                outerRadius - 0.5,
                                accentInnerRadius
                              )}
                              fill={color}
                            />
                          ))}

                          {/* Основные цвета (внутренний круг) */}
                          {isExpanded ? (
                            <g clipPath={`url(#clip-inner-${im.id})`}>
                              {colors.map((color, i) => (
                                <path
                                  key={i}
                                  d={createSegmentPath(i * segmentAngle, (i + 1) * segmentAngle, innerRadius)}
                                  fill={color}
                                />
                              ))}
                              {/* Глянцевый оверлей */}
                              <circle cx={cx} cy={cy} r={innerRadius} fill={`url(#gloss-${im.id})`} />
                            </g>
                          ) : (
                            // Плоский стиль для маленькой кнопки
                            colors.map((color, i) => (
                              <path
                                key={i}
                                d={createSegmentPath(i * segmentAngle, (i + 1) * segmentAngle, innerRadius)}
                                fill={color}
                              />
                            ))
                          )}

                          {/* Внутренняя обводка (между основными и акцентами) */}
                          {hasAccents && (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={innerRadius}
                              fill="none"
                              stroke="rgba(255,255,255,0.6)"
                              strokeWidth={0.5}
                            />
                          )}

                          {/* Внешняя обводка */}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={outerRadius - 0.5}
                            fill="none"
                            stroke={isExpanded ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.5)"}
                            strokeWidth={1}
                          />
                        </svg>
                      </button>
                    );
                  })()}

                  {/* Инфо при наведении */}
                  {showAuthor && (
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
                        <span className="font-ui truncate text-[11px] font-medium drop-shadow-md">{nick}</span>
                      </Link>
                    </div>
                  )}

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

                  {/* Иконки редактирования и удаления (только для владельца) */}
                  {isOwnerView && (
                    <div className="pointer-events-none absolute top-2 right-2 flex gap-1.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      {/* Кнопка редактирования */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `/images/${im.id}/edit`;
                        }}
                        className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                        title="Редактировать"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                        </svg>
                      </button>

                      {/* Кнопка удаления */}
                      <button
                        type="button"
                        onClick={(e) => deleteImage(im.id, im.path, e)}
                        disabled={deletingId === im.id}
                        className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-600 disabled:opacity-50"
                        title="Удалить"
                      >
                        {deletingId === im.id ? (
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </Masonry >
      </div >
      {/* МОДАЛКА С КАРТИНКОЙ */}
      {
        selected && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={closeModal}
          >
            {/* Flex контейнер для кружков + модалки */}
            <div className="flex items-center gap-3">
              {/* Цветовая палитра — слева от модалки */}
              {(Array.isArray(currentColors) && currentColors.length > 0) && (
                <div className="flex-col gap-2 hidden sm:flex items-center">
                  {/* Акцентные цвета сверху */}
                  {selected.accent_colors && selected.accent_colors.length > 0 && (
                    selected.accent_colors.map((c, index) => (
                      <div
                        key={`accent-${c}-${index}`}
                        className="rounded-full border-2 border-white/30 shadow-lg"
                        style={{
                          backgroundColor: c,
                          width: 18,
                          height: 18,
                        }}
                        title={`Акцент: ${c}`}
                      />
                    ))
                  )}

                  {/* Основные цвета */}
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
                      <PromptModal
                        prompt={selected.prompt}
                        description={selected.description}
                        isOpen={showPrompt}
                        onClose={() => setShowPrompt(false)}
                      />

                      {/* Оптическое стекло effect */}
                      <div className="absolute bottom-0 left-0 right-0 bg-white/15 backdrop-blur-sm backdrop-brightness-110 backdrop-contrast-125 p-3 border-t border-white/30">
                        <div className="flex flex-wrap items-center gap-4 text-xs text-white/80">

                          {/* Кнопка Промт + Дата */}
                          <div className="flex flex-col items-center gap-0.5">
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
                            {selected.created_at && (
                              <span className="text-[10px] text-white/50">
                                {formatDate(selected.created_at)}
                              </span>
                            )}
                          </div>

                          {/* Автор */}
                          {(() => {
                            const p = Array.isArray(selected.profiles)
                              ? selected.profiles[0]
                              : selected.profiles;
                            const nick: string = p?.username ?? "user";
                            const avatar: string | null = p?.avatar_url ?? null;
                            return (
                              <Link
                                href={`/u/${encodeURIComponent(nick)}`}
                                className="flex items-center gap-1.5 rounded-full px-2 py-0.5 transition hover:bg-white/20"
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

                          {/* Модель */}
                          <span className="font-mono text-[11px] uppercase tracking-wider text-white/70">
                            {formatModelName(selected.model)}
                          </span>

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
        )
      }
    </>
  );
}
