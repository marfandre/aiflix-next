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
                width={width || undefined}
                height={height || undefined}
                style={{ maxHeight }}
                className={roundedClass}
            >
                {hlsSrc && <source src={hlsSrc} type="application/x-mpegURL" />}
                <source src={src} type="video/mp4" />
            </video>

            {/* Click to play/pause */}
            <div className="absolute inset-0 z-5 cursor-pointer" onClick={togglePlay} onDoubleClick={toggleFullscreen} />

        </div>
    );
}
