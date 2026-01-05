"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Masonry from "react-masonry-css";
import LikeButton from "./LikeButton";
import PromptModal from "./PromptModal";

type Props = {
    userId: string | null;
};

type VideoRow = {
    id: string;
    author_id: string | null;
    title: string | null;
    description?: string | null;
    prompt?: string | null;
    playback_id: string | null;
    created_at: string | null;
    model?: string | null;
    genres?: string[] | null;
    mood?: string | null;
    colors?: string[] | null;
    colors_preview?: string[] | null;  // 15 цветов для hover анимации
    status?: string | null;
    profiles:
    | { username: string | null; avatar_url: string | null }[]
    | { username: string | null; avatar_url: string | null }
    | null;
};

const MODEL_LABELS: Record<string, string> = {
    sora: "Sora",
    pika: "Pika",
    runway: "Runway",
    kling: "Kling",
    "gen-3": "Gen-3",
    midjourney: "Midjourney",
    sdxl: "SDXL",
    dalle: "DALL·E",
    "dall-e": "DALL·E",
    flux: "Flux",
    krea: "KREA",
};

function formatModelName(raw?: string | null): string {
    if (!raw) return "не указана";
    const key = raw.toLowerCase();
    return MODEL_LABELS[key] ?? raw;
}

function muxPoster(playback_id: string | null) {
    return playback_id
        ? `https://image.mux.com/${playback_id}/thumbnail.jpg?time=1`
        : "/placeholder.png";
}

export default function VideoFeedClient({ userId }: Props) {
    const [videos, setVideos] = useState<VideoRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<VideoRow | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [expandedChartId, setExpandedChartId] = useState<string | null>(null);
    const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);  // Для hover-to-play
    const [mp4FailedIds, setMp4FailedIds] = useState<Set<string>>(new Set());  // Видео без MP4 support

    // Dynamic color cycling - накапливаем цвета в очереди
    const [colorQueue, setColorQueue] = useState<Record<string, string[]>>({});
    const [colorOffset, setColorOffset] = useState<Record<string, number>>({});
    const [colorTimeIndex, setColorTimeIndex] = useState<Record<string, number>>({});
    const [colorLoading, setColorLoading] = useState<Record<string, boolean>>({});
    const [cyclingVideoId, setCyclingVideoId] = useState<string | null>(null);
    const [hoverKeys, setHoverKeys] = useState<Record<string, number>>({});  // Ключи для рестарта анимации по video id

    // Refs для элементов анимации — для принудительного рестарта
    const animationRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // Ref для видео в модалке — для умного autoplay со звуком
    const modalVideoRef = useRef<HTMLVideoElement | null>(null);

    // Функция рестарта CSS анимации через DOM
    const restartAnimation = useCallback((videoId: string) => {
        const el = animationRefs.current[videoId];
        if (el) {
            // Сохраняем текущую анимацию
            const currentAnimation = el.style.animation || getComputedStyle(el).animation;
            el.style.animation = 'none';
            el.offsetHeight; // Force reflow
            el.style.animation = currentAnimation;
        }
    }, []);

    // Timestamps for cycling (in seconds) - только первые 5 секунд чтобы совпадать с GIF
    const COLOR_TIMESTAMPS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
    const CYCLE_INTERVAL_MS = 600; // Быстрее для непрерывного потока
    const MAX_QUEUE_SIZE = 25; // Максимальный размер очереди цветов

    const supa = createClientComponentClient();

    // Загрузка видео
    useEffect(() => {
        (async () => {
            setLoading(true);

            // Получаем видео
            const { data: filmsData, error } = await supa
                .from("films")
                .select("id, author_id, title, description, prompt, playback_id, created_at, model, genres, mood, colors, colors_preview, status")
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

            // Получаем уникальные author_id
            const authorIds = [...new Set(filmsData.map(f => f.author_id).filter(Boolean))] as string[];

            // Получаем профили
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

            // Объединяем
            const enrichedVideos: VideoRow[] = filmsData.map(f => ({
                ...f,
                profiles: f.author_id && profilesMap[f.author_id] ? profilesMap[f.author_id] : null
            }));

            setVideos(enrichedVideos);
            setLoading(false);
        })();
    }, [supa]);

    // Realtime подписка
    useEffect(() => {
        const channel = supa
            .channel("videos-feed")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "films",
                },
                async (payload) => {
                    const newVideo = payload.new as VideoRow;

                    if (newVideo.author_id) {
                        const { data: profileData } = await supa
                            .from("profiles")
                            .select("username, avatar_url")
                            .eq("id", newVideo.author_id)
                            .maybeSingle();

                        const enriched: VideoRow = {
                            ...newVideo,
                            profiles: profileData
                                ? [{ username: profileData.username, avatar_url: profileData.avatar_url }]
                                : [],
                        };

                        setVideos((prev) => [enriched, ...prev]);
                    } else {
                        setVideos((prev) => [newVideo, ...prev]);
                    }
                }
            )
            .subscribe();

        return () => {
            supa.removeChannel(channel);
        };
    }, [supa]);

    const closeModal = () => {
        setSelected(null);
        setShowPrompt(false);
    };

    // Умный autoplay — сначала пробуем со звуком, если блокируется — тогда muted
    useEffect(() => {
        const video = modalVideoRef.current;
        if (!video || !selected) return;

        const tryPlay = async () => {
            try {
                // Сначала пробуем воспроизвести со звуком
                video.muted = false;
                await video.play();
            } catch (err) {
                // Браузер заблокировал — пробуем muted
                console.log('Autoplay blocked, trying muted:', err);
                video.muted = true;
                try {
                    await video.play();
                } catch (e) {
                    console.error('Autoplay failed even muted:', e);
                }
            }
        };

        // Небольшая задержка чтобы video элемент успел примонтироваться
        const timer = setTimeout(tryPlay, 100);
        return () => clearTimeout(timer);
    }, [selected]);

    // Функция для ПРЕДЗАГРУЗКИ всех цветов из разных кадров видео (ПАРАЛЛЕЛЬНО)
    const preloadAllColors = useCallback(async (videoId: string, playbackId: string, baseColors: string[]) => {
        setColorLoading(prev => ({ ...prev, [videoId]: true }));

        // Собираем все цвета: начинаем с исходных
        const allColors: string[] = [...baseColors];

        // Параллельно загружаем цвета со всех таймстемпов
        const fetchPromises = COLOR_TIMESTAMPS.map(async (time) => {
            try {
                const res = await fetch(`/api/videos/palette?playbackId=${playbackId}&time=${time}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.colors && data.colors.length > 0) {
                        return { time, colors: data.colors as string[] };
                    }
                }
            } catch (err) {
                console.error('Error fetching colors at', time, err);
            }
            return { time, colors: [] as string[] };
        });

        // Ждём все запросы параллельно
        const results = await Promise.all(fetchPromises);

        // Сортируем по времени и добавляем цвета в правильном порядке
        results
            .sort((a, b) => a.time - b.time)
            .forEach(result => {
                if (result.colors.length > 0) {
                    allColors.push(...result.colors);
                }
            });

        // Убираем дубликаты (оставляем только уникальные цвета в порядке появления)
        const uniqueColors = allColors.filter((color, index, arr) => arr.indexOf(color) === index);
        console.log('Loaded colors for video:', videoId, 'unique:', uniqueColors.length, 'colors:', uniqueColors);
        setColorQueue(prev => ({ ...prev, [videoId]: uniqueColors }));
        setColorLoading(prev => ({ ...prev, [videoId]: false }));

        // Теперь запускаем анимацию
        setCyclingVideoId(videoId);
    }, [COLOR_TIMESTAMPS]);

    // Отключаем автоматическую смену цветов чтобы не прерывать CSS-анимацию
    // (Загрузка новых цветов перезапускала бы анимацию)
    // useEffect(() => {
    //     if (!cyclingVideoId) return;
    //     const video = videos.find(v => v.id === cyclingVideoId);
    //     if (!video || !video.playback_id) {
    //         setCyclingVideoId(null);
    //         return;
    //     }
    //     const intervalId = setInterval(() => {
    //         fetchColorsAtTime(cyclingVideoId, video.playback_id!);
    //     }, CYCLE_INTERVAL_MS);
    //     return () => clearInterval(intervalId);
    // }, [cyclingVideoId, videos, fetchColorsAtTime, CYCLE_INTERVAL_MS]);

    if (loading) return <div className="py-6 text-gray-500">Загрузка...</div>;
    if (videos.length === 0) return <div className="py-6 text-gray-500">Нет видео</div>;

    const selectedProfile = selected
        ? Array.isArray(selected.profiles)
            ? selected.profiles[0]
            : selected.profiles
        : null;

    const hlsSrc = selected?.playback_id
        ? `https://stream.mux.com/${selected.playback_id}.m3u8`
        : null;

    const mp4Src = selected?.playback_id
        ? `https://stream.mux.com/${selected.playback_id}/medium.mp4`
        : null;

    return (
        <>
            {/* СЕТКА ВИДЕО — Masonry стиль */}
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
                    {videos.map((v) => {
                        const p = Array.isArray(v.profiles) ? v.profiles[0] : v.profiles;
                        const nick: string = p?.username ?? "user";
                        const avatar: string | null = p?.avatar_url ?? null;
                        const title = (v.title ?? "").trim() || "Без названия";

                        return (
                            <div
                                key={v.id}
                                className="group relative mb-3"
                                onMouseEnter={() => {
                                    setHoveredVideoId(v.id);
                                    // Сразу запускаем анимацию с базовыми цветами
                                    setCyclingVideoId(v.id);
                                    // Новый ключ для рестарта GIF и анимации капсулы
                                    setHoverKeys(prev => ({ ...prev, [v.id]: Date.now() }));
                                }}
                                onMouseLeave={() => {
                                    setHoveredVideoId(null);
                                    setCyclingVideoId(null);
                                }}
                            >
                                {/* Кликабельная карточка */}
                                <button
                                    type="button"
                                    onClick={() => setSelected(v)}
                                    className="relative block w-full overflow-hidden bg-gray-100"
                                    style={{
                                        aspectRatio: '3/4',
                                    }}
                                >
                                    {/* Статичный постер (всегда виден как fallback) */}
                                    <img
                                        src={muxPoster(v.playback_id)}
                                        alt={title}
                                        className="absolute inset-0 w-full h-full transition-transform duration-300 group-hover:scale-105"
                                        style={{
                                            objectFit: 'cover',
                                            objectPosition: 'center top',
                                        }}
                                    />

                                    {/* Анимированное превью при hover */}
                                    {v.playback_id && hoveredVideoId === v.id && (
                                        <img
                                            src={`https://image.mux.com/${v.playback_id}/animated.gif?fps=15&width=320&t=${hoverKeys[v.id] || 0}`}
                                            alt="Preview"
                                            className="absolute inset-0 w-full h-full z-10"
                                            style={{
                                                objectFit: 'cover',
                                                objectPosition: 'center top',
                                            }}
                                        />
                                    )}

                                    {/* Hover overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                                    {/* Иконка видео */}
                                    <div className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white flex items-center gap-1">
                                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    </div>

                                    {/* Капсула с цветами — 15 цветов для hover анимации */}
                                    {(v.colors_preview || v.colors) && (v.colors_preview || v.colors)!.length > 0 && v.playback_id && (() => {
                                        // Используем colors_preview (15 цветов) или fallback на colors (5 базовых)
                                        const colors = v.colors_preview && v.colors_preview.length > 0
                                            ? v.colors_preview
                                            : (v.colors ?? []);

                                        // Капсула расширяется при hover на карточку
                                        const isHovered = hoveredVideoId === v.id;
                                        const isCycling = cyclingVideoId === v.id;

                                        // Размеры капсулы — увеличиваются при hover
                                        const height = isHovered ? 22 : 16;
                                        const stripeWidth = isHovered ? 18 : 14;
                                        const borderRadius = height / 2;
                                        // Ширина = ровно 3 цвета (скруглённые углы просто обрежут края)
                                        const totalWidth = 3 * stripeWidth;

                                        return (
                                            <div
                                                key={`capsule-${v.id}-${hoverKeys[v.id] || 0}`}
                                                className={`absolute bottom-2 right-2 z-20 transition-all duration-300 overflow-hidden ${isCycling ? 'ring-2 ring-white/50' : ''}`}
                                                style={{
                                                    width: totalWidth,
                                                    height: height,
                                                    borderRadius: borderRadius,
                                                    boxShadow: isHovered
                                                        ? '0 4px 12px rgba(0,0,0,0.4)'
                                                        : '0 1px 4px rgba(0,0,0,0.3)',
                                                    border: '1px solid rgba(255,255,255,0.4)',
                                                }}
                                            >
                                                {/* Бегущая строка — синхронизирована с 5-секундным GIF */}
                                                {(() => {
                                                    // Ширина всех цветов
                                                    const totalColorsWidth = colors.length * stripeWidth;
                                                    // Сдвиг = все цвета минус видимое окно (5 полосок)
                                                    const visibleSlots = 5;
                                                    const shiftDistance = Math.max(0, (colors.length - visibleSlots) * stripeWidth);
                                                    // Длительность = 5 секунд (как GIF)
                                                    const animationDuration = 5;

                                                    return (
                                                        <div
                                                            ref={(el) => { animationRefs.current[v.id] = el; }}
                                                            className="h-full"
                                                            style={{
                                                                width: totalColorsWidth * 2,
                                                                animation: isCycling
                                                                    ? `colorScroll ${animationDuration}s linear infinite`
                                                                    : 'none',
                                                                // Сдвиг на половину (все цвета) для бесшовного цикла
                                                                ['--shift-distance' as string]: `-${totalColorsWidth}px`,
                                                                // Градиент с плавными переходами между цветами
                                                                background: `linear-gradient(to right, ${[...colors, ...colors].join(', ')})`,
                                                            }}
                                                        />
                                                    );
                                                })()}
                                            </div>
                                        );
                                    })()}
                                </button>

                                {/* Overlay с автором */}
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                    <Link
                                        href={`/u/${encodeURIComponent(nick)}`}
                                        className="pointer-events-auto flex items-center gap-1.5 rounded-full px-2 py-1 text-white transition hover:bg-white/20"
                                    >
                                        {avatar && (
                                            <img
                                                src={avatar}
                                                alt={nick}
                                                className="h-[18px] w-[18px] shrink-0 rounded-full object-cover ring-1 ring-white/40"
                                            />
                                        )}
                                        <span className="truncate text-[11px] font-medium drop-shadow-md">
                                            {nick}
                                        </span>
                                    </Link>
                                </div>

                                {/* Кнопка лайка */}
                                <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                    <div className="pointer-events-auto">
                                        <LikeButton
                                            target="film"
                                            id={v.id}
                                            userId={userId}
                                            ownerId={v.author_id}
                                            className="text-white drop-shadow-md"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </Masonry>
            </div>

            {/* МОДАЛКА С ВИДЕО */}
            {/* МОДАЛКА ВИДЕО */}
            {selected && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
                    onClick={closeModal}
                >
                    {/* Flex контейнер для кружков + модалки */}
                    <div className="flex items-center gap-3 w-full max-w-[95vw] justify-center">
                        {/* Цветовая палитра — слева от модалки */}
                        {selected.colors && selected.colors.length > 0 && (
                            <div className="flex-col gap-2 hidden lg:flex">
                                {selected.colors.slice(0, 5).map((c, index) => (
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
                                ))}
                            </div>
                        )}

                        <div
                            className="relative flex max-h-[90vh] w-auto flex-col overflow-hidden rounded-lg shadow-2xl bg-black"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Видеоплеер — без overlay, controls внизу видео */}
                            <div className="relative flex items-center justify-center bg-black">
                                {selected.playback_id ? (
                                    <video
                                        ref={modalVideoRef}
                                        controls
                                        loop
                                        playsInline
                                        disablePictureInPicture
                                        controlsList="nodownload noremoteplayback noplaybackrate"
                                        poster={muxPoster(selected.playback_id)}
                                        className="video-hover-controls max-h-[80vh] w-auto max-w-full object-contain"
                                    >
                                        {selected.playback_id && (
                                            <>
                                                <source src={`https://stream.mux.com/${selected.playback_id}.m3u8`} type="application/x-mpegURL" />
                                                <source src={`https://stream.mux.com/${selected.playback_id}/medium.mp4`} type="video/mp4" />
                                            </>
                                        )}
                                        Ваш браузер не поддерживает воспроизведение видео.
                                    </video>
                                ) : (
                                    <div className="flex h-[40vh] w-full items-center justify-center text-center text-gray-400">
                                        {selected.status === 'processing' ? (
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                                <p>Видео обрабатывается...</p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                <p>Видео недоступно</p>
                                                <p className="text-xs opacity-50">Попробуйте загрузить заново</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <PromptModal
                                    prompt={selected.prompt}
                                    description={selected.description}
                                    isOpen={showPrompt}
                                    onClose={() => setShowPrompt(false)}
                                />
                            </div>

                            {/* Info-bar — отдельный блок ПОД видео (после controls) */}
                            <div className="bg-black/90 backdrop-blur-sm p-3 border-t border-white/20">
                                <div className="flex flex-wrap items-center gap-4 text-xs text-white/80">

                                    {/* Кнопка Промт (копировать) + Дата */}
                                    <div className="flex flex-col items-center gap-0.5">
                                        <button
                                            type="button"
                                            onClick={() => setShowPrompt(true)}
                                            className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 transition hover:bg-white/30 text-white"
                                        >
                                            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                <polyline points="14 2 14 8 20 8" />
                                                <line x1="16" y1="13" x2="8" y2="13" />
                                                <line x1="16" y1="17" x2="8" y2="17" />
                                            </svg>
                                            Промт
                                        </button>
                                        {selected.created_at && (
                                            <span className="text-[10px] text-white/50">
                                                {new Date(selected.created_at).toLocaleDateString("en-US", { month: 'short', year: '2-digit' }).toUpperCase()}
                                            </span>
                                        )}
                                    </div>

                                    {/* Автор */}
                                    <Link
                                        href={`/u/${encodeURIComponent(selectedProfile?.username ?? "user")}`}
                                        className="flex items-center gap-1.5 rounded-full px-2 py-0.5 transition hover:bg-white/20"
                                    >
                                        {selectedProfile?.avatar_url && (
                                            <img
                                                src={selectedProfile.avatar_url}
                                                alt={selectedProfile.username ?? "user"}
                                                className="h-4 w-4 rounded-full object-cover ring-1 ring-white/40"
                                            />
                                        )}
                                        <span className="text-white">{selectedProfile?.username ?? "user"}</span>
                                    </Link>

                                    {/* Модель */}
                                    <span className="font-mono text-[11px] uppercase tracking-wider text-white/70">
                                        {formatModelName(selected.model)}
                                    </span>

                                    {/* Жанры/Муд inline */}
                                    {((selected.genres && selected.genres.length > 0) || selected.mood) && (
                                        <>
                                            {selected.genres?.slice(0, 2).map((g) => (
                                                <span key={g} className="rounded-full bg-white/20 px-2 py-0.5">
                                                    {g}
                                                </span>
                                            ))}
                                            {selected.mood && (
                                                <span className="rounded-full bg-white/20 px-2 py-0.5">
                                                    {selected.mood}
                                                </span>
                                            )}
                                        </>
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

