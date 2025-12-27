"use client";

import { useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import LikeButton from "@/app/components/LikeButton";
import PromptModal from "@/app/components/PromptModal";

type ProfileImage = {
  id: string;
  path: string | null;
  title: string | null;
  description?: string | null;
  prompt?: string | null;
  created_at: string | null;
  colors?: string[] | null;
  model?: string | null;
  tags?: string[] | null;
  images_count?: number | null;
};

type Props = {
  images: ProfileImage[];
  nick: string;
  avatarUrl?: string | null;
  currentUserId: string | null;
};

type ImageVariant = {
  path: string;
  colors: string[] | null;
  order_index: number | null;
};

/** Те же подписи для моделей, что и в ленте */
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

/** Форматирует дату в формате "DEC 25" (месяц + год) */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const year = date.getFullYear().toString().slice(-2);
  return `${month} ${year}`;
}

export default function ProfileImagesClient({
  images,
  nick,
  avatarUrl,
  currentUserId,
}: Props) {
  const supa = createClientComponentClient();

  const [selected, setSelected] = useState<ProfileImage | null>(null);
  const [variants, setVariants] = useState<ImageVariant[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [expandedChartId, setExpandedChartId] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const publicImageUrl = (path: string | null) => {
    if (!path) return "/placeholder.png";
    const { data } = supa.storage.from("images").getPublicUrl(path);
    return data.publicUrl;
  };

  const openImage = async (im: ProfileImage) => {
    if (!im.path) return;

    const fallbackVariant: ImageVariant = {
      path: im.path,
      colors: (im.colors as string[] | null) ?? null,
      order_index: 0,
    };

    setSelected(im);
    setSlideIndex(0);
    setVariants([fallbackVariant]);
    setVariantsLoading(true);

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
          (data as any[]).map((v) => ({
            path: v.path as string,
            colors: (v.colors ?? null) as string[] | null,
            order_index: (v.order_index ?? 0) as number | null,
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

  const currentVariant: ImageVariant | null =
    selected && variants.length
      ? variants[slideIndex] ?? variants[0]
      : null;

  const currentColors =
    currentVariant?.colors && currentVariant.colors.length
      ? currentVariant.colors
      : (selected?.colors as string[] | null) ?? [];

  const hasCarousel = !variantsLoading && variants.length > 1;

  return (
    <>
      {/* сетка в профиле — Lexica-стиль */}
      <div className="overflow-hidden rounded-2xl">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {images.map((im) => {
            const url = publicImageUrl(im.path);
            const imagesCount =
              typeof im.images_count === "number" ? im.images_count : 1;
            const showCarouselBadge = imagesCount > 1;

            return (
              <div
                key={im.id}
                className="group relative"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openImage(im)}
                  onKeyDown={(e) => e.key === 'Enter' && openImage(im)}
                  className="relative block aspect-[4/5] w-full bg-gray-100 cursor-pointer">
                  <img
                    src={url}
                    alt={(im.title ?? "").trim() || "Картинка"}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                  {/* Счётчик изображений (всегда виден) */}
                  {showCarouselBadge && (
                    <div className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
                      {imagesCount}
                    </div>
                  )}

                  {/* Круговая диаграмма цветов */}
                  {im.colors && im.colors.length > 0 && (() => {
                    const colors = im.colors.slice(0, 5);
                    const segmentAngle = 360 / colors.length;
                    const isExpanded = expandedChartId === im.id;
                    const size = isExpanded ? 64 : 20;
                    const radius = size / 2;
                    const cx = radius;
                    const cy = radius;

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
                              <linearGradient id={`gloss-profile-${im.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
                                <stop offset="40%" stopColor="rgba(255,255,255,0.1)" />
                                <stop offset="60%" stopColor="rgba(0,0,0,0)" />
                                <stop offset="100%" stopColor="rgba(0,0,0,0.15)" />
                              </linearGradient>
                              <clipPath id={`clip-profile-${im.id}`}>
                                <circle cx={radius} cy={radius} r={radius} />
                              </clipPath>
                            </defs>
                          )}

                          {isExpanded ? (
                            <g clipPath={`url(#clip-profile-${im.id})`}>
                              {colors.map((color, i) => (
                                <path
                                  key={i}
                                  d={createSegmentPath(i * segmentAngle, (i + 1) * segmentAngle)}
                                  fill={color}
                                />
                              ))}
                              <circle cx={radius} cy={radius} r={radius} fill={`url(#gloss-profile-${im.id})`} />
                            </g>
                          ) : (
                            colors.map((color, i) => (
                              <path
                                key={i}
                                d={createSegmentPath(i * segmentAngle, (i + 1) * segmentAngle)}
                                fill={color}
                              />
                            ))
                          )}

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

                  {/* Никнейм при наведении */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <Link
                      href={`/u/${encodeURIComponent(nick)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="pointer-events-auto flex items-center gap-1.5 rounded-full px-2 py-1 text-white transition hover:bg-white/20"
                    >
                      {avatarUrl && (
                        <img
                          src={avatarUrl}
                          alt={nick}
                          className="h-4 w-4 rounded-full object-cover ring-1 ring-white/40"
                        />
                      )}
                      <span className="truncate text-[11px] font-medium drop-shadow-md">{nick}</span>
                    </Link>
                  </div>

                  {/* Кнопка лайка при наведении */}
                  <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                      <LikeButton
                        target="image"
                        id={im.id}
                        userId={currentUserId}
                        className="text-white drop-shadow-md"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {images.length === 0 && (
            <div className="text-sm text-gray-500">Здесь пока нет картинок.</div>
          )}
        </div>
      </div>
      {/* модалка — image-first дизайн */}
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
                {currentColors.map((c, idx) => (
                  <div
                    key={c + idx}
                    className="rounded-full border-2 border-white/30 shadow-lg"
                    style={{
                      backgroundColor: c,
                      width: 28,
                      height: 28,
                    }}
                    title={c}
                  />
                ))}
              </div>
            )}

            {/* Контейнер изображения */}
            <div
              className="relative flex max-h-[90vh] w-auto max-w-[95vw] flex-col overflow-hidden rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Картинка с overlay */}
              <div className="relative flex items-center justify-center bg-black">
                {currentVariant ? (
                  <>
                    <img
                      src={publicImageUrl(currentVariant.path)}
                      alt={(selected.title ?? "").trim() || "Картинка"}
                      className="max-h-[90vh] w-auto max-w-full object-contain"
                    />

                    {/* Карусель — кнопки */}
                    {hasCarousel && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setSlideIndex(
                              (i) => (i - 1 + variants.length) % variants.length
                            )
                          }
                          className="group absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 shadow-sm backdrop-blur-sm hover:bg-black/60"
                          title="Предыдущее"
                        >
                          <span className="block text-lg leading-none text-white">‹</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setSlideIndex((i) => (i + 1) % variants.length)
                          }
                          className="group absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 shadow-sm backdrop-blur-sm hover:bg-black/60"
                          title="Следующее"
                        >
                          <span className="block text-lg leading-none text-white">›</span>
                        </button>

                        {/* Точки-индикаторы */}
                        <div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 gap-1.5">
                          {variants.map((v, idx) => (
                            <button
                              key={v.path + idx}
                              type="button"
                              onClick={() => setSlideIndex(idx)}
                              className={`h-1.5 w-1.5 rounded-full transition ${idx === slideIndex ? "bg-white" : "bg-white/40"
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

                    {/* Оптическое стекло — нижняя полоска */}
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
                        <Link
                          href={`/u/${encodeURIComponent(nick)}`}
                          className="flex items-center gap-1.5 rounded-full px-2 py-0.5 transition hover:bg-white/20"
                        >
                          {avatarUrl && (
                            <img
                              src={avatarUrl}
                              alt={nick}
                              className="h-4 w-4 rounded-full object-cover ring-1 ring-white/40"
                            />
                          )}
                          <span className="text-white">{nick}</span>
                        </Link>

                        {/* Модель */}
                        <span className="font-mono text-[11px] uppercase tracking-wider text-white/70">
                          {formatModelName(selected.model)}
                        </span>

                        {/* Теги */}
                        {selected.tags && selected.tags.length > 0 && (
                          <>
                            {selected.tags.slice(0, 3).map((tagWithLang) => {
                              const tagName = tagWithLang.includes(':')
                                ? tagWithLang.split(':')[0]
                                : tagWithLang;
                              return (
                                <span
                                  key={tagWithLang}
                                  className="rounded-full bg-white/20 px-2 py-0.5"
                                >
                                  {tagName}
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
                  <p className="text-sm text-white/60">
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
