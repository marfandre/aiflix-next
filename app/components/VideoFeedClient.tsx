"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import LikeButton from "./LikeButton";

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
    const [expandedChartId, setExpandedChartId] = useState<string | null>(null);

    const supa = createClientComponentClient();

    // Загрузка видео
    useEffect(() => {
        (async () => {
            setLoading(true);

            // Получаем видео
            const { data: filmsData, error } = await supa
                .from("films")
                .select("id, author_id, title, description, prompt, playback_id, created_at, model, genres, mood, colors")
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

    const closeModal = () => setSelected(null);

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
            {/* СЕТКА ВИДЕО */}
            <div className="overflow-hidden rounded-2xl">
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {videos.map((v) => {
                        const p = Array.isArray(v.profiles) ? v.profiles[0] : v.profiles;
                        const nick: string = p?.username ?? "user";
                        const avatar: string | null = p?.avatar_url ?? null;
                        const title = (v.title ?? "").trim() || "Без названия";

                        return (
                            <div key={v.id} className="group relative">
                                {/* Кликабельная карточка */}
                                <button
                                    type="button"
                                    onClick={() => setSelected(v)}
                                    className="relative block aspect-[4/5] w-full bg-gray-100 overflow-hidden text-left"
                                >
                                    <img
                                        src={muxPoster(v.playback_id)}
                                        alt={title}
                                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    />

                                    {/* Hover overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                                    {/* Иконка видео */}
                                    <div className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white flex items-center gap-1">
                                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    </div>

                                    {/* Круговая диаграмма цветов */}
                                    {v.colors && v.colors.length > 0 && (() => {
                                        const colors = v.colors.slice(0, 5);
                                        const segmentAngle = 360 / colors.length;
                                        const isExpanded = expandedChartId === v.id;
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
                                                    setExpandedChartId(isExpanded ? null : v.id);
                                                }}
                                                className="absolute bottom-2 right-2 rounded-full z-10 transition-all duration-300 cursor-pointer"
                                                style={{
                                                    width: size,
                                                    height: size,
                                                    boxShadow: isExpanded
                                                        ? '0 4px 12px rgba(0,0,0,0.4)'
                                                        : '0 1px 3px rgba(0,0,0,0.3)'
                                                }}
                                            >
                                                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-full overflow-hidden">
                                                    {colors.map((color, i) => (
                                                        <path
                                                            key={i}
                                                            d={createSegmentPath(i * segmentAngle, (i + 1) * segmentAngle)}
                                                            fill={color}
                                                        />
                                                    ))}
                                                    <circle
                                                        cx={radius}
                                                        cy={radius}
                                                        r={radius - 0.5}
                                                        fill="none"
                                                        stroke="rgba(255,255,255,0.5)"
                                                        strokeWidth={1}
                                                    />
                                                </svg>
                                            </button>
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
                </div>
            </div>

            {/* МОДАЛКА С ВИДЕО */}
            {selected && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
                    onClick={closeModal}
                >
                    <div
                        className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex flex-1 flex-col gap-4 p-4 md:flex-row">
                            {/* ЛЕВАЯ КОЛОНКА — информация */}
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
                                                onClick={async () => {
                                                    const text = selected.prompt || selected.description;
                                                    if (text && navigator.clipboard) {
                                                        await navigator.clipboard.writeText(text);
                                                    }
                                                }}
                                                disabled={!selected.prompt && !selected.description}
                                                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                                            >
                                                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5">
                                                    <rect x="9" y="9" width="11" height="11" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                                                    <rect x="4" y="4" width="11" height="11" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                                                </svg>
                                                <span>Скопировать</span>
                                            </button>
                                        </div>

                                        {(selected.prompt || selected.description) ? (
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

                                    {/* Жанры и атмосфера */}
                                    {((selected.genres && selected.genres.length > 0) || selected.mood) && (
                                        <div className="flex flex-wrap gap-1">
                                            {selected.genres?.map((g) => (
                                                <span
                                                    key={g}
                                                    className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700"
                                                >
                                                    {g}
                                                </span>
                                            ))}
                                            {selected.mood && (
                                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                                                    {selected.mood}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* низ: автор/дата */}
                                <div className="space-y-3">
                                    <div className="mt-4 border-t pt-2 text-xs text-gray-500">
                                        {selectedProfile && (
                                            <Link
                                                href={`/u/${encodeURIComponent(selectedProfile.username ?? "user")}`}
                                                className="font-medium text-gray-700 hover:underline"
                                            >
                                                @{selectedProfile.username ?? "user"}
                                            </Link>
                                        )}
                                        {selected.created_at && (
                                            <div className="mt-0.5">
                                                {new Date(selected.created_at).toLocaleDateString("ru-RU")}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ПРАВАЯ КОЛОНКА — палитра + видеоплеер */}
                            <div className="flex flex-1 flex-col">
                                {/* Цветовая палитра */}
                                {selected.colors && selected.colors.length > 0 && (
                                    <div className="mb-2 flex items-center justify-center gap-1 md:justify-start">
                                        {selected.colors.slice(0, 5).map((c, index) => (
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
                                        ))}
                                    </div>
                                )}

                                {/* Видеоплеер */}
                                <div className="flex flex-1 items-center justify-center rounded-lg bg-black overflow-hidden">
                                    <video
                                        controls
                                        autoPlay
                                        playsInline
                                        poster={muxPoster(selected.playback_id)}
                                        className="max-h-[70vh] w-full object-contain"
                                    >
                                        {hlsSrc && <source src={hlsSrc} type="application/x-mpegURL" />}
                                        {mp4Src && <source src={mp4Src} type="video/mp4" />}
                                        Ваш браузер не поддерживает воспроизведение видео.
                                    </video>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

