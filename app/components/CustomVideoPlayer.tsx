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
    onPlayChange?: (playing: boolean) => void;
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
    onPlayChange,
}: CustomVideoPlayerProps) {
    const internalRef = useRef<HTMLVideoElement>(null);
    const videoEl = externalRef ?? internalRef;

    const containerRef = useRef<HTMLDivElement>(null);
    const timelineRef = useRef<HTMLDivElement>(null);
    const fillRef = useRef<HTMLDivElement>(null);
    const dotRef = useRef<HTMLDivElement>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hlsRef = useRef<any>(null);
    const sourceReadyRef = useRef(false);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [isDragging, setIsDragging] = useState(false);

    const progress = duration > 0 ? currentTime / duration : 0;

    // ----- Continuous gradient from all colors -----
    const hasColors = colors && colors.length >= 3;
    const colorGradient = hasColors
        ? `linear-gradient(90deg, ${colors.join(', ')})`
        : '';

    // ----- Auto-hide controls -----
    const resetHideTimer = useCallback(() => {
        setControlsVisible(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
            if (!isDragging) setControlsVisible(false);
        }, 3000);
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

    // ----- Source setup + autoplay -----
    useEffect(() => {
        const v = videoEl.current;
        if (!v) return;

        let cancelled = false;

        const tryAutoplay = async () => {
            if (cancelled) return;
            try {
                v.muted = false;
                await v.play();
            } catch {
                try {
                    v.muted = true;
                    setIsMuted(true);
                    await v.play();
                } catch { /* autoplay completely blocked — user will tap */ }
            }
        };

        const setup = async () => {
            // 1. Try HLS
            if (hlsSrc) {
                // Safari: native HLS
                if (v.canPlayType('application/vnd.apple.mpegURL')) {
                    v.src = hlsSrc;
                    sourceReadyRef.current = true;
                    v.addEventListener('canplay', () => tryAutoplay(), { once: true });
                    return;
                }

                // Chrome/Firefox: hls.js
                try {
                    const Hls = (await import('hls.js')).default;
                    if (cancelled) return;

                    if (Hls.isSupported()) {
                        const hls = new Hls({ maxBufferLength: 30 });
                        hlsRef.current = hls;
                        hls.loadSource(hlsSrc);
                        hls.attachMedia(v);
                        sourceReadyRef.current = true;
                        hls.on(Hls.Events.MANIFEST_PARSED, () => {
                            if (!cancelled) tryAutoplay();
                        });
                        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
                            if (data.fatal && !cancelled) {
                                // HLS failed — fallback to mp4
                                hls.destroy();
                                hlsRef.current = null;
                                v.src = src;
                                sourceReadyRef.current = true;
                                v.addEventListener('canplay', () => tryAutoplay(), { once: true });
                            }
                        });
                        return;
                    }
                } catch {
                    // hls.js import failed — fall through to mp4
                }
            }

            // 2. Fallback: direct mp4
            if (cancelled) return;
            v.src = src;
            sourceReadyRef.current = true;
            v.addEventListener('canplay', () => tryAutoplay(), { once: true });
        };

        setup();

        return () => {
            cancelled = true;
            try { if (hlsRef.current?.destroy) { hlsRef.current.destroy(); hlsRef.current = null; } } catch {}
        };
    }, [videoEl, hlsSrc, src]);

    // ----- Video event handlers -----
    useEffect(() => {
        const v = videoEl.current;
        if (!v) return;

        const onPlay = () => { setIsPlaying(true); onPlayChange?.(true); };
        const onPause = () => { setIsPlaying(false); onPlayChange?.(false); };
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
        v.addEventListener("durationchange", onDurationChange);
        v.addEventListener("loadedmetadata", onLoadedMeta);
        v.addEventListener("volumechange", onVolumeChange);

        return () => {
            v.removeEventListener("play", onPlay);
            v.removeEventListener("pause", onPause);
            v.removeEventListener("durationchange", onDurationChange);
            v.removeEventListener("loadedmetadata", onLoadedMeta);
            v.removeEventListener("volumechange", onVolumeChange);
        };
    }, [videoEl, onLoadedMetadata]);

    // ----- Smooth 60fps progress via requestAnimationFrame -----
    useEffect(() => {
        const v = videoEl.current;
        if (!v) return;
        let rafId: number;
        let lastDisplayUpdate = 0;
        const tick = () => {
            if (!isDragging && v.duration > 0) {
                const p = v.currentTime / v.duration;
                const pct = `${p * 100}%`;
                // Direct DOM updates — no React re-render
                if (fillRef.current) fillRef.current.style.width = pct;
                if (dotRef.current) dotRef.current.style.left = pct;
                // Update React state for time display ~4x/sec
                const now = performance.now();
                if (now - lastDisplayUpdate > 250) {
                    setCurrentTime(v.currentTime);
                    lastDisplayUpdate = now;
                }
            }
            rafId = requestAnimationFrame(tick);
        };
        if (isPlaying) {
            rafId = requestAnimationFrame(tick);
        } else {
            // Update once when paused
            if (v.duration > 0) {
                const p = v.currentTime / v.duration;
                const pct = `${p * 100}%`;
                if (fillRef.current) fillRef.current.style.width = pct;
                if (dotRef.current) dotRef.current.style.left = pct;
                setCurrentTime(v.currentTime);
            }
        }
        return () => cancelAnimationFrame(rafId);
    }, [videoEl, isPlaying, isDragging]);

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
                preload="metadata"
                width={width || undefined}
                height={height || undefined}
                style={{ maxHeight }}
                className={roundedClass}
            >
                {/* mp4 fallback source — loads immediately while hls.js initializes */}
                <source src={src} type="video/mp4" />
            </video>

            {/* Big play button — visible when paused, works on mobile */}
            {!isPlaying && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                    className="absolute inset-0 z-20 flex items-center justify-center"
                    aria-label="Play"
                >
                    <div className="flex items-center justify-center rounded-full"
                        style={{
                            width: 56, height: 56,
                            background: "rgba(0,0,0,0.5)",
                            backdropFilter: "blur(8px)",
                            WebkitBackdropFilter: "blur(8px)",
                            border: "1px solid rgba(255,255,255,0.15)",
                        }}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                </button>
            )}

            {/* Drag to seek overlay — only when playing */}
            {isPlaying && (
                <div
                    className="absolute inset-0 cursor-pointer"
                    style={{ zIndex: 15 }}
                    onDoubleClick={toggleFullscreen}
                    onContextMenu={(e) => e.preventDefault()}
                    onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.preventDefault();

                        const v = videoEl.current;
                        if (!v) return;

                        // If no duration yet — just toggle play
                        if (!v.duration) {
                            const onUp = () => {
                                window.removeEventListener("pointerup", onUp);
                                togglePlay();
                            };
                            window.addEventListener("pointerup", onUp);
                            return;
                        }

                        setIsDragging(true);

                        let hasDragged = false;
                        const startX = e.clientX;
                        const startRect = e.currentTarget.getBoundingClientRect();
                        const initialTime = v.currentTime;
                        const wasPlaying = !v.paused;

                        const onPointerMove = (ev: PointerEvent) => {
                            const dx = ev.clientX - startX;
                            if (!hasDragged && Math.abs(dx) > 3) {
                                hasDragged = true;
                                if (wasPlaying) v.pause();
                            }

                            if (hasDragged) {
                                const ratio = dx / startRect.width;
                                const timeDelta = ratio * v.duration;
                                let newTime = initialTime + timeDelta;
                                newTime = Math.max(0, Math.min(newTime, v.duration));

                                v.currentTime = newTime;
                                setCurrentTime(newTime);

                                if (fillRef.current) fillRef.current.style.width = `${(newTime / v.duration) * 100}%`;
                                if (dotRef.current) dotRef.current.style.left = `${(newTime / v.duration) * 100}%`;
                            }
                        };

                        const onPointerUp = () => {
                            setIsDragging(false);
                            window.removeEventListener("pointermove", onPointerMove);
                            window.removeEventListener("pointerup", onPointerUp);

                            if (!hasDragged) {
                                togglePlay();
                            } else {
                                if (wasPlaying && v.paused) {
                                    v.play().catch(() => { });
                                }
                            }
                        };

                        window.addEventListener("pointermove", onPointerMove);
                        window.addEventListener("pointerup", onPointerUp);
                    }}
                />
            )}
        </div>
    );
}
