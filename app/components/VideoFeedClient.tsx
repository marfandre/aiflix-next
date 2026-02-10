"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Masonry from "react-masonry-css";
import LikeButton from "./LikeButton";
import PromptModal from "./PromptModal";

type Props = {
    userId: string | null;
    initialVideos?: VideoRow[];  // Для использования в профиле (пропускает загрузку из БД)
    showAuthor?: boolean;        // Показывать ли аватар автора (по умолчанию true)
    isOwnerView?: boolean;       // True если это профиль владельца (показывает удаление)
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
    colors_full?: string[] | null;     // Цвета на всю длительность видео (макс 60 кадров × 3)
    colors_full_interval?: number | null; // Интервал между кадрами в секундах
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
    veo: "Veo",
    "veo-2": "Veo 2",
    "veo-3": "Veo 3",
    "veo-3.1": "Veo 3.1",
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

export default function VideoFeedClient({ userId, initialVideos, showAuthor = true, isOwnerView = false }: Props) {
    const [videos, setVideos] = useState<VideoRow[]>(initialVideos ?? []);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<VideoRow | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [expandedChartId, setExpandedChartId] = useState<string | null>(null);
    const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);  // Для hover-to-play
    const [mp4FailedIds, setMp4FailedIds] = useState<Set<string>>(new Set());  // Видео без MP4 support
    const [deletingId, setDeletingId] = useState<string | null>(null);  // Для анимации удаления

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

    // Refs для preview видео на карточках — для сброса времени на 0
    const previewVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

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

    // Загрузка видео (пропускается если передан initialVideos)
    useEffect(() => {
        // Если переданы начальные видео — пропускаем загрузку из БД
        if (initialVideos && initialVideos.length > 0) {
            setVideos(initialVideos);
            setLoading(false);
            return;
        }

        (async () => {
            setLoading(true);

            // Получаем видео
            const { data: filmsData, error } = await supa
                .from("films")
                .select("id, author_id, title, description, prompt, playback_id, created_at, model, genres, mood, colors, colors_preview, colors_full, colors_full_interval, status")
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
    }, [supa, initialVideos]);

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

    // Таймер для циклической смены цветов синхронно с видео
    useEffect(() => {
        if (!cyclingVideoId) return;

        // Сбрасываем индекс на 0 при старте
        setColorTimeIndex(prev => ({ ...prev, [cyclingVideoId]: 0 }));

        // Каждую секунду увеличиваем индекс (0 -> 1 -> 2 -> 3 -> 4 -> 0...)
        const interval = setInterval(() => {
            setColorTimeIndex(prev => {
                const current = prev[cyclingVideoId!] ?? 0;
                const next = (current + 1) % 5; // 5 кадров = 5 секунд
                return { ...prev, [cyclingVideoId!]: next };
            });
        }, 1000); // каждую секунду

        return () => clearInterval(interval);
    }, [cyclingVideoId]);

    // Индекс кадра цветов для модалки — синхронизируется с video.currentTime
    const [modalColorFrame, setModalColorFrame] = useState(0);

    const closeModal = () => {
        setSelected(null);
        setShowPrompt(false);
    };

    // Синхронизация капсулы в модалке с текущим временем видео
    // Один интервал: проверяет video ref на каждом тике (ref может быть null при первом рендере)
    useEffect(() => {
        if (!selected) {
            setModalColorFrame(0);
            return;
        }

        const hasFullColors = selected.colors_full && selected.colors_full.length > 0;
        const colors = hasFullColors
            ? selected.colors_full!
            : (selected.colors_preview && selected.colors_preview.length > 0
                ? selected.colors_preview
                : (selected.colors ?? []));
        const colorInterval = hasFullColors ? (selected.colors_full_interval ?? 1) : 1;
        const totalFrames = Math.max(1, Math.floor(colors.length / 3));

        if (totalFrames <= 1) return;

        let fallbackFrame = 0;

        const timer = setInterval(() => {
            const video = modalVideoRef.current;

            if (hasFullColors && video) {
                // colors_full есть — привязываемся к currentTime
                if (video.paused) return; // На паузе — не меняем кадр
                const frameIdx = Math.min(
                    Math.floor(video.currentTime / colorInterval),
                    totalFrames - 1
                );
                setModalColorFrame(frameIdx);
            } else {
                // Нет colors_full — циклический перебор (fallback для старых видео)
                fallbackFrame = (fallbackFrame + 1) % totalFrames;
                setModalColorFrame(fallbackFrame);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [selected]);

    // Удаление видео
    const deleteVideo = async (videoId: string, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!confirm('Удалить это видео?')) return;

        setDeletingId(videoId);

        try {
            const res = await fetch('/api/videos/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                console.error('Delete error:', data.error);
                alert('Ошибка при удалении: ' + (data.error || 'Неизвестная ошибка'));
            } else {
                // Удаляем из локального состояния
                setVideos(prev => prev.filter(v => v.id !== videoId));
            }
        } finally {
            setDeletingId(null);
        }
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
                                    // Запускаем анимацию капсулы сразу вместе с WebP
                                    setCyclingVideoId(v.id);
                                    // Новый ключ для рестарта анимации капсулы
                                    setHoverKeys(prev => ({ ...prev, [v.id]: Date.now() }));
                                }}
                                onMouseLeave={() => {
                                    setHoveredVideoId(null);
                                    setCyclingVideoId(null);
                                    // Сбрасываем цвета капсулы на начальный кадр
                                    setColorTimeIndex(prev => ({ ...prev, [v.id]: 0 }));
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

                                    {/* WebP превью при hover — с cache buster для старта сначала */}
                                    {v.playback_id && hoveredVideoId === v.id && (
                                        <img
                                            key={`webp-${v.id}-${hoverKeys[v.id] || 0}`}
                                            src={`https://image.mux.com/${v.playback_id}/animated.webp?fps=15&width=640&t=${hoverKeys[v.id] || 0}`}
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
                                                {/* 3 цвета текущего кадра — меняются каждую секунду */}
                                                {(() => {
                                                    // Текущий индекс кадра (0-4)
                                                    const frameIndex = colorTimeIndex[v.id] ?? 0;
                                                    // 3 цвета для текущего кадра (индексы: 0-2, 3-5, 6-8, 9-11, 12-14)
                                                    const startIdx = frameIndex * 3;
                                                    const frameColors = colors.slice(startIdx, startIdx + 3);

                                                    // Если цветов меньше 3, дублируем последний
                                                    while (frameColors.length < 3 && frameColors.length > 0) {
                                                        frameColors.push(frameColors[frameColors.length - 1]);
                                                    }

                                                    return (
                                                        <div
                                                            className="h-full flex transition-all duration-300"
                                                            style={{ width: '100%' }}
                                                        >
                                                            {frameColors.map((color, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    className="h-full transition-all duration-300"
                                                                    style={{
                                                                        width: stripeWidth,
                                                                        backgroundColor: color,
                                                                    }}
                                                                />
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        );
                                    })()}
                                </button>

                                {/* Overlay с автором */}
                                {showAuthor && (
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
                                            <span className="font-ui truncate text-[11px] font-medium drop-shadow-md">
                                                {nick}
                                            </span>
                                        </Link>
                                    </div>
                                )}

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

                                {/* Кнопка удаления (только для владельца) */}
                                {isOwnerView && (
                                    <div className="pointer-events-none absolute top-2 right-2 z-30 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                        <button
                                            type="button"
                                            onClick={(e) => deleteVideo(v.id, e)}
                                            disabled={deletingId === v.id}
                                            className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-600 disabled:opacity-50"
                                            title="Удалить видео"
                                        >
                                            {deletingId === v.id ? (
                                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                            ) : (
                                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                )}
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
                        {/* Цветовая капсула — слева от модалки (синхронизирована с видео) */}
                        {(selected.colors_full || selected.colors_preview || selected.colors) && (() => {
                            const hasFullColors = selected.colors_full && selected.colors_full.length > 0;
                            const colors = hasFullColors
                                ? selected.colors_full!
                                : (selected.colors_preview && selected.colors_preview.length > 0
                                    ? selected.colors_preview
                                    : (selected.colors ?? []));

                            if (colors.length === 0) return null;

                            const startIdx = modalColorFrame * 3;
                            const frameColors = colors.slice(startIdx, startIdx + 3);
                            while (frameColors.length < 3 && frameColors.length > 0) {
                                frameColors.push(frameColors[frameColors.length - 1]);
                            }

                            return (
                                <div
                                    className="hidden lg:flex overflow-hidden"
                                    style={{
                                        flexDirection: 'column',
                                        width: 22,
                                        height: 90,
                                        borderRadius: 11,
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                                        border: '1px solid rgba(255,255,255,0.3)',
                                    }}
                                >
                                    {frameColors.map((c, index) => (
                                        <div
                                            key={index}
                                            className="flex-1 transition-colors duration-300"
                                            style={{ backgroundColor: c }}
                                            title={c}
                                        />
                                    ))}
                                </div>
                            );
                        })()}

                        <div
                            className="relative flex flex-col overflow-hidden rounded-lg shadow-2xl"
                            style={{ width: '70vw', maxWidth: 960 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Видеоплеер */}
                            <div className="relative flex items-center justify-center bg-black" style={{ aspectRatio: '16/9' }}>
                                {selected.playback_id ? (
                                    <video
                                        ref={modalVideoRef}
                                        controls
                                        loop
                                        playsInline
                                        disablePictureInPicture
                                        controlsList="nodownload noremoteplayback noplaybackrate"
                                        poster={muxPoster(selected.playback_id)}
                                        className="video-hover-controls absolute inset-0 h-full w-full object-contain"
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
                                    <div className="absolute inset-0 flex w-full items-center justify-center text-center text-gray-400">
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

                            {/* Info-bar — отдельный блок ПОД видео */}
                            <div className="bg-black/90 backdrop-blur-sm p-3 border-t border-white/20">
                                <div className="flex flex-wrap items-center gap-4 text-xs text-white/80">

                                    {/* Кнопка Промт + Дата */}
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

