"use client";

import { useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import LikeButton from "@/app/components/LikeButton";

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

export default function ProfileImagesClient({
  images,
  nick,
  currentUserId,
}: Props) {
  const supa = createClientComponentClient();

  const [selected, setSelected] = useState<ProfileImage | null>(null);
  const [variants, setVariants] = useState<ImageVariant[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [expandedChartId, setExpandedChartId] = useState<string | null>(null);

  const publicImageUrl = (path: string | null) => {
    if (!path) return "/placeholder.png";
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
                <button
                  type="button"
                  onClick={() => openImage(im)}
                  className="relative block aspect-[4/5] w-full bg-gray-100"
                >
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
                </button>
              </div>
            );
          })}

          {images.length === 0 && (
            <div className="text-sm text-gray-500">Здесь пока нет картинок.</div>
          )}
        </div>
      </div>
      {/* модалка */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={closeModal}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-1 flex-col gap-4 p-4 md:flex-row">
              {/* левая колонка */}
              <div className="mt-2 flex w-full flex-none flex-col justify-between gap-3 text-sm text-gray-700 md:w-[26rem]">
                {/* верх: ПРОМТ + МОДЕЛЬ */}
                <div className="space-y-3">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                        Промт
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyPrompt}
                        disabled={!selected.prompt && !selected.description}
                        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-3.5 w-3.5"
                        >
                          <rect
                            x="9"
                            y="9"
                            width="11"
                            height="11"
                            rx="2"
                            ry="2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          />
                          <rect
                            x="4"
                            y="4"
                            width="11"
                            height="11"
                            rx="2"
                            ry="2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          />
                        </svg>
                        <span>Скопировать</span>
                      </button>
                    </div>

                    {selected.prompt || selected.description ? (
                      <p className="whitespace-pre-line text-xs text-gray-800">
                        {selected.prompt || selected.description}
                      </p>
                    ) : (
                      <p className="text-[11px] text-gray-400">
                        Промт не указан.
                      </p>
                    )}
                  </div>

                  <div className="text-xs text-gray-600">
                    Модель:{" "}
                    <span className="font-medium">
                      {formatModelName(selected.model)}
                    </span>
                  </div>
                </div>

                {/* низ: ОПИСАНИЕ + ник/дата */}
                <div className="space-y-3">
                  {selected.description && selected.prompt && (
                    <div className="rounded-lg bg-gray-50 p-3">
                      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                        Описание
                      </div>
                      <p className="whitespace-pre-line text-xs text-gray-800">
                        {selected.description}
                      </p>
                    </div>
                  )}

                  <div className="mt-4 border-t pt-2 text-xs text-gray-500">
                    <Link
                      href={`/u/${encodeURIComponent(nick)}`}
                      className="font-medium text-gray-700 hover:underline"
                    >
                      @{nick}
                    </Link>
                    {selected.created_at && (
                      <div className="mt-0.5">
                        {new Date(selected.created_at).toLocaleDateString(
                          "ru-RU"
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* правая колонка */}
              <div className="flex flex-1 flex-col">
                <div className="mb-2 flex items-center justify-center gap-1 md:justify-start">
                  {Array.isArray(currentColors) &&
                    currentColors.length > 0 &&
                    currentColors.map((c, index) => {
                      if (!c) return null;
                      return (
                        <div
                          key={c + index}
                          className="rounded-full border border-gray-200"
                          style={{
                            backgroundColor: c,
                            width: 32,
                            height: 32,
                          }}
                          title={c}
                        />
                      );
                    })}
                </div>

                <div className="relative flex flex-1 items-center justify-center rounded-lg bg-gray-50">
                  {currentVariant ? (
                    <>
                      <img
                        src={publicImageUrl(currentVariant.path)}
                        alt={(selected.title ?? "").trim() || "Картинка"}
                        className="max-h-[80vh] w-full object-contain"
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
                            title="Следующее изображение"
                          >
                            <span className="block text-lg leading-none text-white transition-transform group-hover:translate-x-0.5">
                              ›
                            </span>
                          </button>

                          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
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
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Не удалось загрузить изображение.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
