"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Masonry from "react-masonry-css";
import LikeButton from "./LikeButton";
import PromptModal from "./PromptModal";
import CustomVideoPlayer from "./CustomVideoPlayer";

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
    color_mode?: string | null; // 'dynamic' | 'static' | 'none'
    status?: string | null;
    aspect_ratio?: string | null;
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
    const [copied, setCopied] = useState(false);  // Для кнопки "Поделиться"
    const [videoTime, setVideoTime] = useState(0);  // Текущее время видео для синхронизации точек

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
    const [modalMuted, setModalMuted] = useState(false);

    // Mouse idle detection — скрываем иконку звука после 3с без движения мыши
    const [mouseIdle, setMouseIdle] = useState(false);
    const mouseIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetMouseIdle = useCallback(() => {
        setMouseIdle(false);
        if (mouseIdleTimer.current) clearTimeout(mouseIdleTimer.current);
        mouseIdleTimer.current = setTimeout(() => setMouseIdle(true), 2000);
    }, []);

    // Очистка таймера при закрытии модалки
    useEffect(() => {
        if (!selected) {
            setMouseIdle(false);
            if (mouseIdleTimer.current) clearTimeout(mouseIdleTimer.current);
        }
    }, [selected]);

    // Refs для внешнего таймлайна (под видео)
    const extTimelineRef = useRef<HTMLDivElement | null>(null);
    const extFillRef = useRef<HTMLDivElement | null>(null);

    // RAF для плавного обновления таймлайна + периодическое обновление точек
    useEffect(() => {
        if (!selected) return;
        let rafId: number;
        let lastDotsUpdate = 0;
        const tick = () => {
            const v = modalVideoRef.current;
            if (v && v.duration > 0) {
                const pct = `${(v.currentTime / v.duration) * 100}%`;
                // Direct DOM update for smooth timeline
                if (extFillRef.current) extFillRef.current.style.width = pct;
                // Update dots ~4x/sec
                const now = performance.now();
                if (now - lastDotsUpdate > 250) {
                    setVideoTime(v.currentTime);
                    lastDotsUpdate = now;
                }
            }
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [selected]);

    const [imageWidth, setImageWidth] = useState<number | null>(null);
    const [modalHoveredColor, setModalHoveredColor] = useState<number | null>(null);
    const [modalPlaying, setModalPlaying] = useState(false);

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

    // Точные пиксельные размеры видео в модалке (предотвращает скачки)
    const [modalWidth, setModalWidth] = useState(0);
    const [modalHeight, setModalHeight] = useState(0);

    // Вычислить оптимальные размеры контейнера по aspect ratio
    const computeModalSize = useCallback((aspect: number) => {
        const maxW = Math.min(window.innerWidth * 0.85, 960);
        const maxH = window.innerHeight * 0.8;
        let w = maxW;
        let h = w / aspect;
        if (h > maxH) {
            h = maxH;
            w = h * aspect;
        }
        setModalWidth(Math.round(w));
        setModalHeight(Math.round(h));
    }, []);

    // При выборе видео — предзагрузка постера для определения пропорций
    // (постер уже в кеше браузера из ленты → onload срабатывает мгновенно)
    useEffect(() => {
        if (!selected?.playback_id) return;

        // Сразу ставим дефолт 16:9 чтобы контейнер был с первого кадра
        computeModalSize(16 / 9);

        const img = new Image();
        img.onload = () => {
            if (img.naturalWidth && img.naturalHeight) {
                computeModalSize(img.naturalWidth / img.naturalHeight);
            }
        };
        img.src = muxPoster(selected.playback_id);
    }, [selected, computeModalSize]);

    // Backup: если постер не дал размеры — берём из метаданных видео
    const handleVideoMetadata = useCallback(() => {
        const video = modalVideoRef.current;
        if (video && video.videoWidth && video.videoHeight) {
            computeModalSize(video.videoWidth / video.videoHeight);
        }
    }, [computeModalSize]);

    const closeModal = () => {
        setSelected(null);
        setShowPrompt(false);
        // Restore the original URL
        window.history.pushState({}, '', window.location.pathname.startsWith('/film/') ? '/' : window.location.pathname + window.location.search);
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

    // Autoplay теперь обрабатывается внутри CustomVideoPlayer

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
                    className="flex -ml-1 w-auto"
                    columnClassName="pl-1 bg-clip-padding"
                >
                    {videos.map((v) => {
                        const p = Array.isArray(v.profiles) ? v.profiles[0] : v.profiles;
                        const nick: string = p?.username ?? "user";
                        const avatar: string | null = p?.avatar_url ?? null;
                        const title = (v.title ?? "").trim() || "Без названия";

                        return (
                            <div
                                key={v.id}
                                className="group relative mb-1"
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
                                    onClick={() => {
                                        setSelected(v);
                                        window.history.pushState({ videoId: v.id }, '', `/film/${v.id}`);
                                    }}
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

                                    {/* Цветовой кружок (палитра) — кликабельный */}
                                    {v.color_mode !== 'none' && (v.colors ?? []).length > 0 && (() => {
                                        const staticColors = (v.colors ?? []).slice(0, 5);
                                        if (staticColors.length === 0) return null;

                                        const isExpanded = expandedChartId === v.id;
                                        const baseSize = isExpanded ? 64 : 20;
                                        const size = baseSize;
                                        const cx = size / 2;
                                        const cy = size / 2;
                                        const r = size / 2;
                                        const segmentAngle = 360 / staticColors.length;

                                        const createSegmentPath = (startAngle: number, endAngle: number) => {
                                            const startRad = (startAngle - 90) * Math.PI / 180;
                                            const endRad = (endAngle - 90) * Math.PI / 180;
                                            const x1 = cx + r * Math.cos(startRad);
                                            const y1 = cy + r * Math.sin(startRad);
                                            const x2 = cx + r * Math.cos(endRad);
                                            const y2 = cy + r * Math.sin(endRad);
                                            const largeArc = endAngle - startAngle > 180 ? 1 : 0;
                                            return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                                        };

                                        return (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedChartId(isExpanded ? null : v.id);
                                                }}
                                                className="absolute bottom-2 right-2 z-20 rounded-full transition-all duration-300 cursor-pointer"
                                                style={{
                                                    width: size,
                                                    height: size,
                                                    boxShadow: isExpanded
                                                        ? '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 3px rgba(255,255,255,0.3)'
                                                        : '0 1px 3px rgba(0,0,0,0.3)',
                                                }}
                                                title={`Нажмите чтобы ${isExpanded ? 'свернуть' : 'увеличить'}`}
                                            >
                                                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-full overflow-hidden">
                                                    {isExpanded && (
                                                        <defs>
                                                            <linearGradient id={`gloss-v-${v.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                                <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
                                                                <stop offset="40%" stopColor="rgba(255,255,255,0.1)" />
                                                                <stop offset="60%" stopColor="rgba(0,0,0,0)" />
                                                                <stop offset="100%" stopColor="rgba(0,0,0,0.15)" />
                                                            </linearGradient>
                                                        </defs>
                                                    )}
                                                    {staticColors.map((color, i) => (
                                                        <path
                                                            key={i}
                                                            d={createSegmentPath(i * segmentAngle, (i + 1) * segmentAngle)}
                                                            fill={color}
                                                        />
                                                    ))}
                                                    {isExpanded && (
                                                        <circle cx={cx} cy={cy} r={r} fill={`url(#gloss-v-${v.id})`} pointerEvents="none" />
                                                    )}
                                                    <circle
                                                        cx={cx}
                                                        cy={cy}
                                                        r={r - 0.5}
                                                        fill="none"
                                                        stroke={isExpanded ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.5)"}
                                                        strokeWidth={1}
                                                    />
                                                </svg>
                                            </button>
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

            {/* МОДАЛКА ВИДЕО */}
            {selected && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
                    onClick={closeModal}
                >
                    <div className="group/modal flex items-center gap-3" onMouseMove={resetMouseIdle}>

                        {/* Вертикальный контейнер: [book] сверху, [инфо-бар] снизу */}
                        <div className="flex flex-col items-center">

                            {/* Book container — info panel + video side by side */}
                            <div className="flex items-stretch sm:max-w-[95vw] relative" onClick={(e) => e.stopPropagation()}>
                                {/* Left page — info panel */}
                                <div
                                    className={`hidden sm:flex overflow-hidden transition-all duration-300 ease-in-out ${showPrompt ? 'max-w-[340px] opacity-100' : 'max-w-0 opacity-0'}`}
                                >
                                    <div className="w-[340px] h-full bg-neutral-900/70 backdrop-blur-xl rounded-l-xl p-6 flex flex-col gap-5 text-white overflow-y-auto scrollbar-thin z-20" style={{ maxHeight: '90vh' }}>
                                        {/* Prompt */}
                                        {selected.prompt && (
                                            <div className="rounded-xl bg-white/5 border border-white/10 p-4 relative group/prompt">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Промт</h3>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(selected.prompt || '');
                                                            const icon = document.getElementById('copy-prompt-icon');
                                                            const check = document.getElementById('copy-prompt-check');
                                                            if (icon && check) { icon.classList.add('hidden'); check.classList.remove('hidden'); setTimeout(() => { icon.classList.remove('hidden'); check.classList.add('hidden'); }, 1500); }
                                                        }}
                                                        className="text-white/30 hover:text-white/70 transition p-1 rounded-md hover:bg-white/10"
                                                        title="Скопировать промт"
                                                    >
                                                        <svg id="copy-prompt-icon" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                        </svg>
                                                        <svg id="copy-prompt-check" className="h-4 w-4 hidden text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="20 6 9 17 4 12" />
                                                        </svg>
                                                    </button>
                                                </div>
                                                <div className="max-h-[150px] overflow-y-auto pr-1 scrollbar-thin">
                                                    <p className="text-[13px] text-white/90 leading-relaxed whitespace-pre-wrap">{selected.prompt}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Description */}
                                        {selected.description && (
                                            <div>
                                                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">Описание</h3>
                                                <p className="text-[13px] text-white/80 leading-relaxed">{selected.description}</p>
                                            </div>
                                        )}

                                        {!selected.prompt && (
                                            <div className="rounded-xl bg-white/5 border border-white/10 p-4 opacity-40">
                                                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">Промт</h3>
                                                <p className="text-[13px] text-white/50 italic">Промт не указан</p>
                                            </div>
                                        )}

                                        <hr className="border-white/10" />

                                        {/* Author */}
                                        {(() => {
                                            const p = Array.isArray(selected.profiles) ? selected.profiles[0] : selected.profiles;
                                            const nick = p?.username ?? "user";
                                            const avatar = p?.avatar_url ?? null;
                                            return (
                                                <div>
                                                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">Автор</h3>
                                                    <Link href={`/u/${encodeURIComponent(nick)}`} className="inline-flex items-center gap-2.5 rounded-full bg-white/5 px-3 py-1.5 transition hover:bg-white/10">
                                                        {avatar && <img src={avatar} alt={nick} className="h-6 w-6 rounded-full object-cover ring-1 ring-white/30" />}
                                                        <span className="text-sm text-white font-medium">{nick}</span>
                                                    </Link>
                                                </div>
                                            );
                                        })()}

                                        {/* Model */}
                                        <div>
                                            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">Модель</h3>
                                            <span className="inline-block rounded-full bg-white/5 px-3 py-1 text-sm font-mono text-white/80">{formatModelName(selected.model)}</span>
                                        </div>

                                        {/* Format */}
                                        {selected.aspect_ratio && (
                                            <div>
                                                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">Формат</h3>
                                                <span className="inline-block rounded-full bg-white/5 px-3 py-1 text-sm font-mono text-white/80">{selected.aspect_ratio}</span>
                                            </div>
                                        )}

                                        {/* Date */}
                                        {selected.created_at && (
                                            <div>
                                                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">Дата</h3>
                                                <span className="text-sm text-white/60">{new Date(selected.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right page wrapper — video */}
                                <div className="relative flex flex-1">
                                    {/* Color circles — spine (когда панель открыта), привязаны к левому краю картинки */}
                                    {showPrompt && selected.colors && selected.colors.length > 0 && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full flex-col gap-2 hidden sm:flex items-end z-30" style={{ paddingRight: '4px' }}>
                                            {selected.colors.slice(0, 5).map((c, index) => {
                                                const isHovered = modalHoveredColor === index;
                                                return (
                                                    <div key={`spine-${c}-${index}`} className="flex items-center gap-1">
                                                        <span className={`text-[9px] font-mono uppercase transition-all duration-150 ${isHovered ? 'text-white/90' : 'text-white/50'}`}>{c}</span>
                                                        <div className={`w-8 h-[1px] transition-all duration-150 ${isHovered ? 'bg-white/60' : 'bg-white/30'}`} />
                                                        <div
                                                            className={`rounded-full shadow-lg cursor-pointer transition-all duration-150 flex-shrink-0
                                                                ${isHovered ? 'border border-white' : 'border border-white/30'}`}
                                                            style={{
                                                                backgroundColor: c,
                                                                width: 28,
                                                                height: 28,
                                                            }}
                                                            title={c}
                                                            onMouseEnter={() => setModalHoveredColor(index)}
                                                            onMouseLeave={() => setModalHoveredColor(null)}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    <div className={`relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-black rounded-none ${showPrompt ? 'sm:rounded-r-xl sm:rounded-l-none' : 'sm:rounded-xl'} shadow-2xl h-full w-full`}>
                                        {selected.playback_id ? (
                                            <CustomVideoPlayer
                                                src={`https://stream.mux.com/${selected.playback_id}/medium.mp4`}
                                                hlsSrc={`https://stream.mux.com/${selected.playback_id}.m3u8`}
                                                poster={muxPoster(selected.playback_id)}
                                                colors={selected.colors ?? undefined}
                                                colorInterval={1}
                                                width={modalWidth || undefined}
                                                height={modalHeight || undefined}
                                                maxHeight="85vh"
                                                onLoadedMetadata={handleVideoMetadata}
                                                videoRef={modalVideoRef}
                                                className="w-full h-full [&>video]:h-full [&>video]:object-contain"
                                                onPlayChange={setModalPlaying}
                                            />
                                        ) : (
                                            <div
                                                className="flex items-center justify-center bg-neutral-900 text-center text-gray-400"
                                                style={{ width: 'min(85vw, 960px)', aspectRatio: '16/9' }}
                                            >
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

                                        {/* Timeline — inside rounded container so corners are clipped */}
                                        {selected.playback_id && (
                                            <div
                                                ref={extTimelineRef}
                                                className="cursor-pointer"
                                                style={{
                                                    width: '100%',
                                                    height: 3,
                                                    background: 'rgba(255,255,255,0.08)',
                                                    overflow: 'hidden',
                                                    transition: 'height 0.15s ease',
                                                    flexShrink: 0,
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.height = '6px'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.height = '3px'; }}
                                                onMouseDown={(e) => {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                                                    const v = modalVideoRef.current;
                                                    if (v && v.duration) {
                                                        v.currentTime = ratio * v.duration;
                                                        if (extFillRef.current) extFillRef.current.style.width = `${ratio * 100}%`;
                                                    }
                                                    const onMove = (ev: MouseEvent) => {
                                                        const r = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
                                                        if (v && v.duration) {
                                                            v.currentTime = r * v.duration;
                                                            if (extFillRef.current) extFillRef.current.style.width = `${r * 100}%`;
                                                        }
                                                    };
                                                    const onUp = () => {
                                                        window.removeEventListener('mousemove', onMove);
                                                        window.removeEventListener('mouseup', onUp);
                                                    };
                                                    window.addEventListener('mousemove', onMove);
                                                    window.addEventListener('mouseup', onUp);
                                                }}
                                            >
                                                <div
                                                    ref={extFillRef}
                                                    style={{
                                                        height: '100%',
                                                        width: 0,
                                                        background: 'rgba(255,255,255,0.35)',
                                                    }}
                                                />
                                            </div>
                                        )}

                                    </div>
                                </div>
                            </div>{/* Close book container */}

                            {/* Кнопки Play и Звук (показываются под таймлайном если открыта левая панель) */}
                            {showPrompt && (
                                <div className="flex justify-between w-full" style={{ paddingLeft: '340px' }}>
                                    <div className="flex gap-3 px-3 mt-3 w-full justify-center">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const v = modalVideoRef.current;
                                                if (v) {
                                                    if (v.paused) v.play();
                                                    else v.pause();
                                                }
                                            }}
                                            className="flex items-center justify-center flex-shrink-0 text-white/80 hover:text-white transition-all rounded-full"
                                            style={{
                                                width: 32,
                                                height: 32,
                                                background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)',
                                                backdropFilter: 'blur(24px) saturate(1.4)',
                                                WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
                                                border: '1px solid rgba(255,255,255,0.18)',
                                                boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                                            }}
                                            title={modalPlaying ? "Пауза" : "Играть"}
                                        >
                                            {modalPlaying ? (
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                                    <rect x="6" y="4" width="4" height="16" />
                                                    <rect x="14" y="4" width="4" height="16" />
                                                </svg>
                                            ) : (
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M8 5v14l11-7z" />
                                                </svg>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const v = modalVideoRef.current;
                                                if (v) {
                                                    v.muted = !v.muted;
                                                    setModalMuted(v.muted);
                                                }
                                            }}
                                            className="flex items-center justify-center flex-shrink-0 text-white/80 hover:text-white transition-all rounded-full"
                                            style={{
                                                width: 32,
                                                height: 32,
                                                background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)',
                                                backdropFilter: 'blur(24px) saturate(1.4)',
                                                WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
                                                border: '1px solid rgba(255,255,255,0.18)',
                                                boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                                            }}
                                            title="Звук"
                                        >
                                            {modalMuted ? (
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                                    <line x1="23" y1="9" x2="17" y2="15" />
                                                    <line x1="17" y1="9" x2="23" y2="15" />
                                                </svg>
                                            ) : (
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Инфо-bar + цветовая капсула — отцентрирована по видео */}
                            <div className={`mt-3 flex justify-center transition-opacity duration-300 ${showPrompt ? 'sm:opacity-0 sm:pointer-events-none' : ''}`} onClick={(e) => e.stopPropagation()}>
                                <div className="relative inline-flex">
                                    {/* Кнопки вынесены из потока и висят слева */}
                                    <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 flex items-center gap-3">
                                        {/* Кнопка Play/Pause вне видео */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const v = modalVideoRef.current;
                                                if (v) {
                                                    if (v.paused) v.play();
                                                    else v.pause();
                                                }
                                            }}
                                            className="flex items-center justify-center flex-shrink-0 text-white/80 hover:text-white transition-all rounded-full"
                                            style={{
                                                width: 32,
                                                height: 32,
                                                background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)',
                                                backdropFilter: 'blur(24px) saturate(1.4)',
                                                WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
                                                border: '1px solid rgba(255,255,255,0.18)',
                                                boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                                            }}
                                            title={modalPlaying ? "Пауза" : "Играть"}
                                        >
                                            {modalPlaying ? (
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                                    <rect x="6" y="4" width="4" height="16" />
                                                    <rect x="14" y="4" width="4" height="16" />
                                                </svg>
                                            ) : (
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M8 5v14l11-7z" />
                                                </svg>
                                            )}
                                        </button>

                                        {/* Кнопка звука вне видео (справа от Play) */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const v = modalVideoRef.current;
                                                if (v) {
                                                    v.muted = !v.muted;
                                                    setModalMuted(v.muted);
                                                }
                                            }}
                                            className="flex items-center justify-center flex-shrink-0 text-white/80 hover:text-white transition-all rounded-full"
                                            style={{
                                                width: 32,
                                                height: 32,
                                                background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)',
                                                backdropFilter: 'blur(24px) saturate(1.4)',
                                                WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
                                                border: '1px solid rgba(255,255,255,0.18)',
                                                boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                                            }}
                                            title="Звук"
                                        >
                                            {modalMuted ? (
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                                    <line x1="23" y1="9" x2="17" y2="15" />
                                                    <line x1="17" y1="9" x2="23" y2="15" />
                                                </svg>
                                            ) : (
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>

                                    {/* Инфо-полоска со встроенной цветовой капсулой */}
                                    <div
                                        className="inline-flex items-center gap-4 rounded-full pl-1.5 pr-6 py-1.5 text-sm text-white"
                                        style={{
                                            minWidth: 480,
                                            background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)',
                                            backdropFilter: 'blur(24px) saturate(1.4)',
                                            WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
                                            border: '1px solid rgba(255,255,255,0.18)',
                                            boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                                        }}
                                    >
                                        {/* Цветовые точки — статические 5 базовых цветов */}
                                        {selected.color_mode !== 'none' && (selected.colors ?? []).length > 0 && (() => {
                                            const colors = (selected.colors ?? []).slice(0, 5);

                                            return (
                                                <div className="group/dots flex-shrink-0 flex items-center pl-1">
                                                    {colors.map((c, index) => (
                                                        <div
                                                            key={`infobar-color-${index}`}
                                                            className="transition-all duration-300 rounded-full"
                                                            style={{
                                                                width: 22,
                                                                height: 22,
                                                                backgroundColor: c,
                                                                border: '1px solid rgba(255,255,255,0.15)',
                                                                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                                                                marginLeft: index > 0 ? -6 : 0,
                                                                zIndex: 5 - index,
                                                            }}
                                                            title={c}
                                                        />
                                                    ))}
                                                </div>
                                            );
                                        })()}

                                        {/* Название */}
                                        {selected.title && (
                                            <span className="text-xs font-semibold text-white truncate max-w-[200px]" title={selected.title}>
                                                {selected.title}
                                            </span>
                                        )}

                                        {/* Кнопка Промт */}
                                        <button
                                            type="button"
                                            onClick={() => setShowPrompt(true)}
                                            className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 transition hover:bg-white/30 text-white font-medium text-xs"
                                        >
                                            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                <polyline points="14 2 14 8 20 8" />
                                                <line x1="16" y1="13" x2="8" y2="13" />
                                                <line x1="16" y1="17" x2="8" y2="17" />
                                            </svg>
                                            Промт
                                        </button>

                                        {/* Автор */}
                                        <Link
                                            href={`/u/${encodeURIComponent(selectedProfile?.username ?? "user")}`}
                                            className="flex items-center gap-2 transition hover:opacity-80"
                                        >
                                            {selectedProfile?.avatar_url && (
                                                <img
                                                    src={selectedProfile.avatar_url}
                                                    alt={selectedProfile.username ?? "user"}
                                                    className="h-5 w-5 rounded-full object-cover ring-1 ring-white/30"
                                                />
                                            )}
                                            <span className="text-white font-medium text-xs">{selectedProfile?.username ?? "user"}</span>
                                        </Link>

                                        {/* Модель */}
                                        <span className="font-mono text-xs uppercase tracking-wider text-white/70">
                                            {formatModelName(selected.model)}
                                        </span>
                                    </div>
                                </div>
                            </div>{/* Close inner relative wrapper */}
                        </div>{/* Close outer wrapper */}

                        {/* Кнопки справа от модалки — поделиться + лайк + инфо */}
                        <div className="hidden sm:flex flex-col items-center self-stretch gap-2" onClick={(e) => e.stopPropagation()}>
                            {/* Поделиться */}
                            <button
                                type="button"
                                onClick={() => {
                                    const url = `${window.location.origin}/film/${selected.id}`;
                                    navigator.clipboard.writeText(url).then(() => {
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    });
                                }}
                                className={`flex h-14 w-14 items-center justify-center rounded-xl transition ${copied
                                    ? 'bg-green-500/80 text-white'
                                    : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                                    }`}
                                title={copied ? 'Скопировано!' : 'Поделиться'}
                            >
                                {copied ? (
                                    <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                        <polyline points="15 3 21 3 21 9" />
                                        <line x1="10" y1="14" x2="21" y2="3" />
                                    </svg>
                                )}
                            </button>

                            {/* Лайк */}
                            <LikeButton
                                target="film"
                                id={selected.id}
                                userId={userId}
                                ownerId={selected.author_id}
                                className="!h-14 !w-14 !rounded-xl !bg-white/10 !text-white/70 hover:!bg-white/20 hover:!text-white !backdrop-blur-none [&_svg]:!h-7 [&_svg]:!w-7"
                            />

                            {/* Информация (промт) */}
                            <button
                                type="button"
                                onClick={() => setShowPrompt((v) => !v)}
                                className={`flex h-14 w-14 items-center justify-center rounded-xl transition ${showPrompt
                                    ? 'bg-white/30 text-white'
                                    : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                                    }`}
                                title="Информация"
                            >
                                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="16" x2="12" y2="12" />
                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                            </button>


                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
