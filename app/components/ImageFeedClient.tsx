"use client";

import { useEffect, useState } from "react";
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
      {/* СЕТКА ЛЕНТЫ */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
              className="overflow-hidden rounded-xl border bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => openImage(im)}
                className="relative block aspect-square w-full bg-gray-100"
              >
                <img
                  src={url}
                  alt={title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {showCarouselBadge && (
                  <div className="absolute bottom-1 right-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
                    {imagesCount}
                  </div>
                )}
              </button>

              <div className="px-4 py-3">
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  <Link
                    href={`/u/${encodeURIComponent(nick)}`}
                    className="flex min-w-0 items-center gap-2 hover:underline"
                  >
                    {avatar && (
                      <img
                        src={avatar}
                        alt={nick}
                        className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-gray-300"
                      />
                    )}
                    <span className="truncate">@{nick}</span>
                  </Link>

                  <LikeButton
                    target="image"
                    id={im.id}
                    userId={userId}
                    ownerId={im.user_id}
                    className="ml-auto shrink-0"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* МОДАЛКА С КАРТИНКОЙ */}
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
              {/* ЛЕВАЯ КОЛОНКА */}
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

                  {/* Теги */}
                  {selected.tags && selected.tags.length > 0 && (
                    <div className="mt-2">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                        Теги
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {selected.tags.map((tagWithLang) => {
                          // Парсим формат tag_id:lang
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
                              className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700"
                            >
                              {displayName}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* низ: ОПИСАНИЕ + автор/дата */}
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
                    {(() => {
                      const p = Array.isArray(selected.profiles)
                        ? selected.profiles[0]
                        : selected.profiles;
                      const nick: string = p?.username ?? "user";
                      return (
                        <Link
                          href={`/u/${encodeURIComponent(nick)}`}
                          className="font-medium text-gray-700 hover:underline"
                        >
                          @{nick}
                        </Link>
                      );
                    })()}
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

              {/* ПРАВАЯ КОЛОНКА — палитра + картинка */}
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
