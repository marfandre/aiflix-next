"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import "./CustomVideoPlayer.css";

type CustomVideoPlayerProps = {
    src: string;
    hlsSrc?: string;
    poster?: string;
    colors?: string[];
    colorInterval?: number;
    width?: number;
    height?: number;
    maxHeight?: string;
    loop?: boolean;
    onLoadedMetadata?: () => void;
    videoRef?: React.RefObject<HTMLVideoElement | null>;
    className?: string;
    roundedClass?: string;
};

function formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function CustomVideoPlayer({
    src,
    hlsSrc,
    poster,
    colors,
    colorInterval = 1,
    width,
    height,
    maxHeight = "85vh",
    loop = true,
    onLoadedMetadata,
    videoRef: externalRef,
    className = "",
    roundedClass = "",
}: CustomVideoPlayerProps) {
    const internalRef = useRef<HTMLVideoElement>(null);
    const videoEl = externalRef ?? internalRef;

    const containerRef = useRef<HTMLDivElement>(null);
    const timelineRef = useRef<HTMLDivElement>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [isDragging, setIsDragging] = useState(false);

    const progress = duration > 0 ? currentTime / duration : 0;

    // ----- Color segments logic -----
    const hasColors = colors && colors.length >= 3;
    const segmentCount = hasColors ? Math.floor(colors.length / 3) : 0;
    const currentSegment = hasColors && duration > 0
        ? Math.min(Math.floor(currentTime / (duration / segmentCount)), segmentCount - 1)
        : 0;

    // Dominant color for each segment (use the first of the 3 colors per frame)
    const segmentColors = hasColors
        ? Array.from({ length: segmentCount }, (_, i) => colors[i * 3])
        : [];

    // ----- Auto-hide controls -----
    const resetHideTimer = useCallback(() => {
        setControlsVisible(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
            if (!isDragging) setControlsVisible(false);
        }, 2500);
    }, [isDragging]);

    const handleMouseMove = useCallback(() => {
        resetHideTimer();
    }, [resetHideTimer]);

    // ----- Play / Pause -----
    const togglePlay = useCallback(() => {
        const v = videoEl.current;
        if (!v) return;
        if (v.paused) {
            v.play().catch(() => {
                v.muted = true;
                v.play().catch(() => { });
            });
        } else {
            v.pause();
        }
    }, [videoEl]);

    // ----- Smart autoplay with sound -----
    useEffect(() => {
        const v = videoEl.current;
        if (!v) return;

        const tryPlay = async () => {
            try {
                v.muted = false;
                await v.play();
            } catch {
                v.muted = true;
                setIsMuted(true);
                try { await v.play(); } catch { }
            }
        };

        const timer = setTimeout(tryPlay, 100);
        return () => clearTimeout(timer);
    }, [videoEl]);

    // ----- Video event handlers -----
    useEffect(() => {
        const v = videoEl.current;
        if (!v) return;

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onTimeUpdate = () => {
            if (!isDragging) setCurrentTime(v.currentTime);
        };
        const onDurationChange = () => setDuration(v.duration || 0);
        const onLoadedMeta = () => {
            setDuration(v.duration || 0);
            onLoadedMetadata?.();
        };
        const onVolumeChange = () => {
            setVolume(v.volume);
            setIsMuted(v.muted);
        };

        v.addEventListener("play", onPlay);
        v.addEventListener("pause", onPause);
        v.addEventListener("timeupdate", onTimeUpdate);
        v.addEventListener("durationchange", onDurationChange);
        v.addEventListener("loadedmetadata", onLoadedMeta);
        v.addEventListener("volumechange", onVolumeChange);

        return () => {
            v.removeEventListener("play", onPlay);
            v.removeEventListener("pause", onPause);
            v.removeEventListener("timeupdate", onTimeUpdate);
            v.removeEventListener("durationchange", onDurationChange);
            v.removeEventListener("loadedmetadata", onLoadedMeta);
            v.removeEventListener("volumechange", onVolumeChange);
        };
    }, [videoEl, isDragging, onLoadedMetadata]);

    // ----- Fullscreen -----
    const toggleFullscreen = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;
        if (!document.fullscreenElement) {
            el.requestFullscreen?.().catch(() => { });
        } else {
            document.exitFullscreen?.().catch(() => { });
        }
    }, []);

    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", handler);
        return () => document.removeEventListener("fullscreenchange", handler);
    }, []);

    // ----- Timeline seek (click + drag) -----
    const seekTo = useCallback((clientX: number) => {
        const tl = timelineRef.current;
        const v = videoEl.current;
        if (!tl || !v || !duration) return;
        const rect = tl.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        v.currentTime = ratio * duration;
        setCurrentTime(ratio * duration);
    }, [videoEl, duration]);

    const handleTimelineMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        seekTo(e.clientX);

        const onMove = (ev: MouseEvent) => seekTo(ev.clientX);
        const onUp = () => {
            setIsDragging(false);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }, [seekTo]);

    // ----- Volume -----
    const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const v = videoEl.current;
        if (!v) return;
        const val = parseFloat(e.target.value);
        v.volume = val;
        v.muted = val === 0;
    }, [videoEl]);

    const toggleMute = useCallback(() => {
        const v = videoEl.current;
        if (!v) return;
        v.muted = !v.muted;
    }, [videoEl]);

    // ----- Keyboard -----
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Only react if this player's container (or its children) has focus or is hovered
            if (!containerRef.current?.contains(document.activeElement) &&
                !containerRef.current?.matches(':hover')) return;

            const v = videoEl.current;
            if (!v) return;

            switch (e.code) {
                case "Space":
                    e.preventDefault();
                    togglePlay();
                    break;
                case "ArrowLeft":
                    e.preventDefault();
                    v.currentTime = Math.max(0, v.currentTime - 5);
                    break;
                case "ArrowRight":
                    e.preventDefault();
                    v.currentTime = Math.min(v.duration, v.currentTime + 5);
                    break;
                case "KeyF":
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case "KeyM":
                    e.preventDefault();
                    toggleMute();
                    break;
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [videoEl, togglePlay, toggleFullscreen, toggleMute]);

    return (
        <div
            ref={containerRef}
            className={`custom-player ${!isPlaying ? "paused" : ""} ${controlsVisible ? "controls-visible" : ""} ${className}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => {
                if (isPlaying && !isDragging) setControlsVisible(false);
            }}
            tabIndex={0}
            style={{ outline: "none" }}
        >
            {/* Video element */}
            <video
                ref={videoEl as React.RefObject<HTMLVideoElement>}
                loop={loop}
                playsInline
                disablePictureInPicture
                poster={poster}
                width={width || undefined}
                height={height || undefined}
                style={{ maxHeight }}
                className={roundedClass}
            >
                {hlsSrc && <source src={hlsSrc} type="application/x-mpegURL" />}
                <source src={src} type="video/mp4" />
            </video>

            {/* Click to play/pause */}
            <div className="play-overlay" onClick={togglePlay}>
                {!isPlaying && (
                    <div className="play-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                )}
            </div>

            {/* Controls Bar */}
            <div className="controls-bar" onClick={(e) => e.stopPropagation()}>
                {/* Glass Pill Timeline */}
                <div
                    ref={timelineRef}
                    className="glass-timeline"
                    onMouseDown={handleTimelineMouseDown}
                >
                    {hasColors ? (
                        <>
                            {segmentColors.map((color, i) => {
                                let state: string;
                                if (i < currentSegment) state = "played";
                                else if (i === currentSegment) state = "current";
                                else state = "upcoming";
                                return (
                                    <div
                                        key={i}
                                        className={`color-segment ${state}`}
                                        style={{ backgroundColor: color }}
                                    />
                                );
                            })}
                            <div
                                className="progress-dot"
                                style={{ left: `${progress * 100}%` }}
                            />
                        </>
                    ) : (
                        <>
                            <div
                                className="plain-fill"
                                style={{ width: `${progress * 100}%` }}
                            />
                            <div
                                className="progress-dot"
                                style={{ left: `${progress * 100}%` }}
                            />
                        </>
                    )}
                </div>

                {/* Controls row */}
                <div className="controls-row">
                    {/* Play/Pause */}
                    <button type="button" className="ctrl-btn" onClick={togglePlay} title={isPlaying ? "Пауза" : "Воспроизвести"}>
                        {isPlaying ? (
                            <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                        ) : (
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                        )}
                    </button>

                    {/* Time */}
                    <span className="time-display">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>

                    <div className="spacer" />

                    {/* Volume */}
                    <div className="volume-group">
                        <button type="button" className="ctrl-btn" onClick={toggleMute} title={isMuted ? "Включить звук" : "Выключить звук"}>
                            {isMuted || volume === 0 ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                    <line x1="23" y1="9" x2="17" y2="15" />
                                    <line x1="17" y1="9" x2="23" y2="15" />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                </svg>
                            )}
                        </button>
                        <div className="volume-slider">
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                            />
                        </div>
                    </div>

                    {/* Fullscreen */}
                    <button type="button" className="ctrl-btn" onClick={toggleFullscreen} title={isFullscreen ? "Выйти из полноэкранного" : "Полноэкранный"}>
                        {isFullscreen ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                            </svg>
                        ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
