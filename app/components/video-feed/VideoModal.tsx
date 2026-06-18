"use client";

import { useState, useRef, useCallback, useEffect, type RefObject } from "react";
import Link from "next/link";
import LikeButton from "../LikeButton";
import CustomVideoPlayer from "../CustomVideoPlayer";
import { formatModelName, muxPoster } from "./utils";
import type { VideoRow } from "./types";
import { useI18n, useT } from "@/lib/i18n/I18nProvider";
import { SHOW_PUBLIC_AUTHOR_IDENTITY } from "@/lib/publicIdentity";

type Props = {
  selected: VideoRow;
  videos?: VideoRow[];
  userId: string | null;
  onClose: () => void;
  onNavigate?: (video: VideoRow) => void;
};

/** Plain <video> with hls.js source — no overlay divs, works on Android */
function MobileVideo({
  playbackId, poster, onPlayChange, onLoadedMetadata, rounded = true,
}: {
  playbackId: string;
  poster: string;
  onPlayChange: (playing: boolean) => void;
  onLoadedMetadata: () => void;
  rounded?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    let hls: any;
    let cancelled = false;
    const hlsUrl = `https://stream.mux.com/${playbackId}.m3u8`;
    const mp4Url = `https://stream.mux.com/${playbackId}/medium.mp4`;

    const tryAutoplay = async () => {
      if (cancelled) return;
      try {
        video.muted = true;
        await video.play();
      } catch { /* user will tap native play button */ }
    };

    const setup = async () => {
      // Safari: native HLS
      if (video.canPlayType('application/vnd.apple.mpegURL')) {
        video.src = hlsUrl;
        video.addEventListener('canplay', () => tryAutoplay(), { once: true });
        video.addEventListener('error', () => setError(t('video.loadFailedShort')), { once: true });
        return;
      }

      // Chrome/Firefox: hls.js
      try {
        const Hls = (await import('hls.js')).default;
        if (cancelled) return;

        if (Hls.isSupported()) {
          hls = new Hls({ maxBufferLength: 30 });
          hls.loadSource(hlsUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!cancelled) tryAutoplay();
          });
          hls.on(Hls.Events.ERROR, (_: any, data: any) => {
            if (data.fatal && !cancelled) {
              hls.destroy();
              hls = null;
              // fallback to mp4
              video.src = mp4Url;
              video.addEventListener('canplay', () => tryAutoplay(), { once: true });
              video.addEventListener('error', () => setError(t('video.loadFailedShort')), { once: true });
            }
          });
          return;
        }
      } catch { /* hls.js import failed */ }

      // Last fallback: mp4
      video.src = mp4Url;
      video.addEventListener('canplay', () => tryAutoplay(), { once: true });
      video.addEventListener('error', () => setError(t('video.loadFailedShort')), { once: true });
    };

    setup();

    return () => {
      cancelled = true;
      try { if (hls?.destroy) hls.destroy(); } catch {}
    };
  }, [playbackId]);

  const togglePlay = useCallback(() => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  return (
    <>
      <video
        ref={ref}
        poster={poster}
        loop
        playsInline
        preload="metadata"
        className="w-full h-full"
        style={{
          objectFit: "contain",
          borderRadius: rounded ? 16 : 0,
          transition: "border-radius 0.3s",
        }}
        onClick={togglePlay}
        onPlay={() => onPlayChange(true)}
        onPause={() => onPlayChange(false)}
        onLoadedMetadata={onLoadedMetadata}
      />
      {/* Mute/unmute button */}
      <button
        type="button"
        onClick={toggleMute}
        className="absolute bottom-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
      >
        {muted ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
      </button>
      {error && <div className="absolute bottom-4 left-4 right-4 text-center text-red-400 text-sm bg-black/80 rounded-lg px-3 py-2">{error}</div>}
    </>
  );
}

export default function VideoModal({ selected, videos, userId, onClose, onNavigate }: Props) {
  const { t, locale } = useI18n();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'en-US';
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [modalHoveredColor, setModalHoveredColor] = useState<number | null>(null);
  const [modalPlaying, setModalPlaying] = useState(false);
  const [modalMuted, setModalMuted] = useState(false);
  const [modalWidth, setModalWidth] = useState(0);
  const [modalHeight, setModalHeight] = useState(0);

  // Saved states
  const [promptSaved, setPromptSaved] = useState<'idle' | 'saving' | 'error'>('idle');
  const [savedPromptId, setSavedPromptId] = useState<string | null>(null);
  const [paletteSaved, setPaletteSaved] = useState<'idle' | 'saving' | 'error'>('idle');
  const [savedPaletteId, setSavedPaletteId] = useState<string | null>(null);

  const modalVideoRef = useRef<HTMLVideoElement | null>(null);
  const extTimelineRef = useRef<HTMLDivElement | null>(null);
  const extFillRef = useRef<HTMLDivElement | null>(null);

  // Mobile bottom sheet state
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [promptCopiedMobile, setPromptCopiedMobile] = useState(false);
  const [sheetDragOffset, setSheetDragOffset] = useState(0);
  const touchStartY = useRef<number | null>(null);
  const touchCurrentY = useRef<number | null>(null);

  // Mobile timeline refs
  const mobTimelineRef = useRef<HTMLDivElement | null>(null);
  const mobFillRef = useRef<HTMLDivElement | null>(null);

  // --- Mobile video swipe gestures (left/right = navigate, down = close) ---
  const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0 });
  const [swipeClosing, setSwipeClosing] = useState(false);
  const videoSwipeStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const videoSwipeDir = useRef<"horizontal" | "vertical" | null>(null);

  const currentIndex = videos ? videos.findIndex(v => v.id === selected.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = videos ? currentIndex < videos.length - 1 : false;

  const handleVideoTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't interfere with bottom sheet touches
    const t = e.touches[0];
    videoSwipeStart.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    videoSwipeDir.current = null;
    setSwipeOffset({ x: 0, y: 0 });
  }, []);

  const handleVideoTouchMove = useCallback((e: React.TouchEvent) => {
    if (!videoSwipeStart.current) return;
    const t = e.touches[0];
    const dx = t.clientX - videoSwipeStart.current.x;
    const dy = t.clientY - videoSwipeStart.current.y;

    // Lock direction after 10px movement
    if (!videoSwipeDir.current) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        videoSwipeDir.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      } else {
        return;
      }
    }

    if (videoSwipeDir.current === "horizontal") {
      // Resist if no video in that direction
      const resist = (dx > 0 && !hasPrev) || (dx < 0 && !hasNext) ? 0.3 : 1;
      setSwipeOffset({ x: dx * resist, y: 0 });
    } else {
      // Only allow swipe down (dy > 0)
      setSwipeOffset({ x: 0, y: Math.max(0, dy) });
    }
  }, [hasPrev, hasNext]);

  const handleVideoTouchEnd = useCallback(() => {
    if (!videoSwipeStart.current) return;
    const { x: ox, y: oy } = swipeOffset;
    const threshold = 80;

    if (videoSwipeDir.current === "horizontal") {
      if (ox < -threshold && hasNext && videos && onNavigate) {
        onNavigate(videos[currentIndex + 1]);
      } else if (ox > threshold && hasPrev && videos && onNavigate) {
        onNavigate(videos[currentIndex - 1]);
      }
    } else if (videoSwipeDir.current === "vertical") {
      if (oy > threshold) {
        setSwipeClosing(true);
        setTimeout(onClose, 200);
        return;
      }
    }

    videoSwipeStart.current = null;
    videoSwipeDir.current = null;
    setSwipeOffset({ x: 0, y: 0 });
  }, [swipeOffset, hasPrev, hasNext, videos, currentIndex, onNavigate, onClose]);

  // Mouse idle detection (desktop)
  const [mouseIdle, setMouseIdle] = useState(false);
  const mouseIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetMouseIdle = useCallback(() => {
    setMouseIdle(false);
    if (mouseIdleTimer.current) clearTimeout(mouseIdleTimer.current);
    mouseIdleTimer.current = setTimeout(() => setMouseIdle(true), 2000);
  }, []);

  useEffect(() => {
    return () => { if (mouseIdleTimer.current) clearTimeout(mouseIdleTimer.current); };
  }, []);

  // RAF for smooth timeline (both desktop and mobile)
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const v = modalVideoRef.current;
      if (v && v.duration > 0) {
        const pct = `${(v.currentTime / v.duration) * 100}%`;
        if (extFillRef.current) extFillRef.current.style.width = pct;
        if (mobFillRef.current) mobFillRef.current.style.width = pct;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Compute modal size from aspect ratio (desktop)
  const computeModalSize = useCallback((aspect: number) => {
    const maxW = Math.min(window.innerWidth * 0.85, 960);
    const maxH = window.innerHeight * 0.8;
    let w = maxW;
    let h = w / aspect;
    if (h > maxH) { h = maxH; w = h * aspect; }
    setModalWidth(Math.round(w));
    setModalHeight(Math.round(h));
  }, []);

  // Preload poster to get aspect ratio
  useEffect(() => {
    if (!selected.playback_id) return;
    computeModalSize(16 / 9);
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) computeModalSize(img.naturalWidth / img.naturalHeight);
    };
    img.src = muxPoster(selected.playback_id);
  }, [selected, computeModalSize]);

  const handleVideoMetadata = useCallback(() => {
    const video = modalVideoRef.current;
    if (video && video.videoWidth && video.videoHeight) computeModalSize(video.videoWidth / video.videoHeight);
  }, [computeModalSize]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // --- Bottom sheet swipe handlers ---
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    touchCurrentY.current = e.touches[0].clientY;
    const delta = touchStartY.current - touchCurrentY.current;
    if (sheetExpanded) {
      if (delta < 0) setSheetDragOffset(delta);
    } else {
      if (delta > 0) setSheetDragOffset(delta);
    }
  }, [sheetExpanded]);

  const handleTouchEnd = useCallback(() => {
    if (touchStartY.current === null || touchCurrentY.current === null) return;
    const delta = touchStartY.current - touchCurrentY.current;
    const threshold = 60;
    if (sheetExpanded) {
      if (delta < -threshold) setSheetExpanded(false);
    } else {
      if (delta > threshold) setSheetExpanded(true);
    }
    touchStartY.current = null;
    touchCurrentY.current = null;
    setSheetDragOffset(0);
  }, [sheetExpanded]);

  const profile = Array.isArray(selected.profiles) ? selected.profiles[0] : selected.profiles;
  const nick = profile?.username ?? "user";
  const avatar = profile?.avatar_url ?? null;
  const colors = (selected.colors ?? []).slice(0, 5);

  // Проверяем, сохранены ли промт и палитра этого видео
  useEffect(() => {
    let cancelled = false;
    setSavedPromptId(null);
    setSavedPaletteId(null);
    if (!selected.id) return;
    (async () => {
      try {
        const [pRes, plRes] = await Promise.all([
          fetch(`/api/saved-prompts/check?source_type=film&source_id=${encodeURIComponent(selected.id)}`),
          fetch(`/api/saved-palettes/check?source_type=film&source_id=${encodeURIComponent(selected.id)}`),
        ]);
        if (!cancelled && pRes.ok) { const j = await pRes.json(); setSavedPromptId(j?.id ?? null); }
        if (!cancelled && plRes.ok) { const j = await plRes.json(); setSavedPaletteId(j?.id ?? null); }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [selected.id]);

  const togglePromptSave = async () => {
    if (!selected.prompt || promptSaved === 'saving') return;
    setPromptSaved('saving');
    if (savedPromptId) {
      try {
        const res = await fetch(`/api/saved-prompts/${savedPromptId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('delete failed');
        setSavedPromptId(null); setPromptSaved('idle');
      } catch { setPromptSaved('error'); setTimeout(() => setPromptSaved('idle'), 2000); }
      return;
    }
    try {
      const res = await fetch('/api/saved-prompts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: selected.prompt, model: selected.model ?? null, seed: (selected as any).seed ?? null, aspect_ratio: selected.aspect_ratio ?? null, source_type: 'film', source_id: selected.id }),
      });
      if (!res.ok) { if (res.status === 401) { alert(t('image.signInToSavePrompt')); setPromptSaved('idle'); return; } throw new Error(); }
      const j = await res.json(); setSavedPromptId(j?.id ?? null); setPromptSaved('idle');
    } catch { setPromptSaved('error'); setTimeout(() => setPromptSaved('idle'), 2000); }
  };

  const togglePaletteSave = async () => {
    const c = colors.filter(Boolean);
    if (c.length === 0 || paletteSaved === 'saving') return;
    setPaletteSaved('saving');
    if (savedPaletteId) {
      try {
        const res = await fetch(`/api/saved-palettes/${savedPaletteId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('delete failed');
        setSavedPaletteId(null); setPaletteSaved('idle');
      } catch { setPaletteSaved('error'); setTimeout(() => setPaletteSaved('idle'), 2000); }
      return;
    }
    try {
      const res = await fetch('/api/saved-palettes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colors: c.slice(0, 10), source_type: 'film', source_id: selected.id }),
      });
      if (!res.ok) { if (res.status === 401) { alert(t('image.signInToSavePalette')); setPaletteSaved('idle'); return; } throw new Error(); }
      const j = await res.json(); setSavedPaletteId(j?.id ?? null); setPaletteSaved('idle');
    } catch { setPaletteSaved('error'); setTimeout(() => setPaletteSaved('idle'), 2000); }
  };

  const shareVideo = async () => {
    const shareUrl = `${window.location.origin}/film/${selected.id}`;
    if (navigator.share) {
      try { await navigator.share({ url: shareUrl }); return; } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyPromptMobile = async () => {
    try {
      await navigator.clipboard.writeText(selected.prompt || "");
      setPromptCopiedMobile(true);
      setTimeout(() => setPromptCopiedMobile(false), 2000);
    } catch { /* ignore */ }
  };

  const glassStyle = {
    background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)",
    backdropFilter: "blur(24px) saturate(1.4)",
    WebkitBackdropFilter: "blur(24px) saturate(1.4)",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
  };

  const renderPlayBtn = () => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); const v = modalVideoRef.current; if (v) { v.paused ? v.play() : v.pause(); } }}
      className="flex items-center justify-center flex-shrink-0 text-white/80 hover:text-white transition-all rounded-full"
      style={{ width: 32, height: 32, ...glassStyle }}
      title={modalPlaying ? t('video.pause') : t('video.play')}
    >
      {modalPlaying ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      )}
    </button>
  );

  const renderMuteBtn = () => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); const v = modalVideoRef.current; if (v) { v.muted = !v.muted; setModalMuted(v.muted); } }}
      className="flex items-center justify-center flex-shrink-0 text-white/80 hover:text-white transition-all rounded-full"
      style={{ width: 32, height: 32, ...glassStyle }}
      title={t('video.sound')}
    >
      {modalMuted ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      )}
    </button>
  );

  const handleTimelineSeek = (e: React.MouseEvent<HTMLDivElement>) => {
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
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Mobile timeline touch seek
  const handleMobileTimelineTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
    const v = modalVideoRef.current;
    if (v && v.duration) {
      v.currentTime = ratio * v.duration;
      if (mobFillRef.current) mobFillRef.current.style.width = `${ratio * 100}%`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>

      {/* ==================== MOBILE VERSION ==================== */}
      <div
        className="sm:hidden fixed inset-0 z-50 flex flex-col bg-black"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: swipeClosing
            ? "translateY(100%)"
            : swipeOffset.y > 0
              ? `translateY(${swipeOffset.y}px)`
              : undefined,
          opacity: swipeOffset.y > 0 ? Math.max(0.3, 1 - swipeOffset.y / 400) : 1,
          transition: swipeClosing
            ? "transform 0.2s ease-out, opacity 0.2s ease-out"
            : videoSwipeDir.current === "vertical"
              ? "none"
              : "transform 0.3s ease-out, opacity 0.3s ease-out",
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Video area with swipe gestures */}
        <div
          className="relative flex items-center justify-center flex-1 min-h-0 px-3"
          onTouchStart={handleVideoTouchStart}
          onTouchMove={handleVideoTouchMove}
          onTouchEnd={handleVideoTouchEnd}
          style={{
            transform: swipeOffset.x !== 0 ? `translateX(${swipeOffset.x}px)` : undefined,
            opacity: swipeOffset.x !== 0 ? Math.max(0.5, 1 - Math.abs(swipeOffset.x) / 400) : 1,
            transition: videoSwipeDir.current === "horizontal" ? "none" : "transform 0.3s ease-out, opacity 0.3s ease-out",
          }}
        >
          {selected.playback_id ? (
            <MobileVideo
              playbackId={selected.playback_id}
              poster={muxPoster(selected.playback_id)}
              onPlayChange={setModalPlaying}
              onLoadedMetadata={() => {}}
              rounded={!sheetExpanded}
            />
          ) : (
            <div className="flex items-center justify-center text-center text-gray-400 p-8">
              {selected.status === "processing" ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <p>{t('video.processing')}</p>
                </div>
              ) : (
                <p>{t('video.unavailable')}</p>
              )}
            </div>
          )}
        </div>

        {/* Mobile timeline */}
        {selected.playback_id && (
          <div
            ref={mobTimelineRef}
            className="flex-shrink-0"
            style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.08)" }}
            onTouchStart={handleMobileTimelineTouch}
            onTouchMove={handleMobileTimelineTouch}
          >
            <div ref={mobFillRef} style={{ height: "100%", width: 0, background: "rgba(255,255,255,0.35)" }} />
          </div>
        )}

        {/* Bottom sheet */}
        <div
          className="relative bg-neutral-900 rounded-t-2xl transition-[max-height] duration-300 ease-out flex-shrink-0 flex flex-col overflow-hidden"
          style={{
            maxHeight: sheetExpanded ? "70vh" : "110px",
            transform: sheetDragOffset !== 0
              ? `translateY(${sheetExpanded ? Math.max(0, -sheetDragOffset) : Math.max(0, -sheetDragOffset * 0.3)}px)`
              : undefined,
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-2.5 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/30" />
          </div>

          {/* Collapsed: author + actions + prompt preview */}
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              {SHOW_PUBLIC_AUTHOR_IDENTITY && (
                <Link href={`/u/${encodeURIComponent(nick)}`} className="flex items-center gap-2 min-w-0">
                  {avatar && <img src={avatar} alt={nick} className="h-7 w-7 rounded-full object-cover ring-1 ring-white/30 flex-shrink-0" />}
                  <span className="text-sm text-white font-medium truncate">{nick}</span>
                </Link>
              )}

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Like */}
                <LikeButton
                  target="film"
                  id={selected.id}
                  userId={userId}
                  ownerId={selected.author_id}
                  className="!h-9 !w-9 !rounded-full !bg-white/10 !text-white/70 [&_svg]:!h-5 [&_svg]:!w-5"
                />
                {/* Share */}
                <button
                  type="button"
                  onClick={shareVideo}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${copied ? "bg-green-500/80 text-white" : "bg-white/10 text-white/70"}`}
                >
                  {copied ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  )}
                </button>
                {/* Info toggle */}
                <button
                  type="button"
                  onClick={() => setSheetExpanded(v => !v)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${sheetExpanded ? "bg-white/25 text-white" : "bg-white/10 text-white/70"}`}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Prompt preview (1 line) — hidden when expanded */}
            {selected.prompt && !sheetExpanded && (
              <p className="text-[13px] text-white/60 truncate">{selected.prompt}</p>
            )}
          </div>

          {/* Expanded content */}
          {sheetExpanded && (
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="px-4 pb-8 flex flex-col gap-4">
                <hr className="border-white/10" />

                {/* Full prompt */}
                {selected.prompt && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{t('image.prompt')}</h3>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={copyPromptMobile}
                          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition ${promptCopiedMobile ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/50"}`}
                        >
                          {promptCopiedMobile ? (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              {t('common.copied')}
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                              {t('common.copy')}
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={togglePromptSave}
                          disabled={promptSaved === 'saving'}
                          className={`flex h-7 w-7 items-center justify-center rounded-full transition ${promptSaved === 'error' ? 'bg-red-500/20 text-red-400' : savedPromptId ? 'bg-white/20 text-white' : 'bg-white/10 text-white/50'}`}
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill={savedPromptId ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className="text-[13px] text-white/80 leading-relaxed whitespace-pre-wrap">{selected.prompt}</p>
                  </div>
                )}

                {/* Description */}
                {selected.description && (
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{t('image.description')}</h3>
                    <p className="text-[13px] text-white/70 leading-relaxed">{selected.description}</p>
                  </div>
                )}

                {/* Colors */}
                {colors.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{t('image.palette')}</h3>
                      <button
                        type="button"
                        onClick={togglePaletteSave}
                        disabled={paletteSaved === 'saving'}
                        className={`flex h-7 w-7 items-center justify-center rounded-full transition ${paletteSaved === 'error' ? 'bg-red-500/20 text-red-400' : savedPaletteId ? 'bg-white/20 text-white' : 'bg-white/10 text-white/50'}`}
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill={savedPaletteId ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {colors.map((c, index) => {
                        if (!c) return null;
                        const isActive = modalHoveredColor === index;
                        return (
                          <button
                            key={`sheet-${c}-${index}`}
                            type="button"
                            onClick={() => setModalHoveredColor(isActive ? null : index)}
                            className={`rounded-full transition-all duration-150 flex-shrink-0 ${isActive ? "ring-2 ring-white scale-110" : "ring-1 ring-white/30"}`}
                            style={{ backgroundColor: c, width: 32, height: 32 }}
                          />
                        );
                      })}
                      {modalHoveredColor !== null && colors[modalHoveredColor] && (
                        <span className="text-xs font-mono text-white/70 ml-1 uppercase">{colors[modalHoveredColor]}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Model + Format */}
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1">{t('image.model')}</h3>
                    <button type="button" onClick={() => { window.location.href = `/?t=video&models=${encodeURIComponent(selected.model || '')}`; }} className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-mono text-white/80 transition hover:bg-white/25 cursor-pointer">{formatModelName(selected.model)}</button>
                  </div>
                  {selected.aspect_ratio && (
                    <div>
                      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1">{t('image.format')}</h3>
                      <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-mono text-white/80">{selected.aspect_ratio}</span>
                    </div>
                  )}
                </div>

                {/* Date */}
                {selected.created_at && (
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1">{t('image.date')}</h3>
                    <span className="text-sm text-white/50">{new Date(selected.created_at).toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" })}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================== DESKTOP VERSION ==================== */}
      <div className="hidden sm:flex items-center gap-3" onMouseMove={resetMouseIdle}>
        <div className="flex flex-col items-center">
          {/* Book container */}
          <div className="flex items-stretch sm:max-w-[95vw] relative" onClick={(e) => e.stopPropagation()}>
            {/* Left page — info panel */}
            <div className={`flex overflow-hidden transition-all duration-300 ease-in-out ${showPrompt ? "max-w-[340px] opacity-100" : "max-w-0 opacity-0"}`}>
              <div className="w-[340px] h-full bg-neutral-900/70 backdrop-blur-xl rounded-l-xl p-6 flex flex-col gap-5 text-white overflow-y-auto scrollbar-thin z-20" style={{ maxHeight: "90vh" }}>
                {/* Prompt */}
                {selected.prompt ? (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-4 relative group/prompt">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{t('image.prompt')}</h3>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(selected.prompt || "")}
                          className="text-white/30 hover:text-white/70 transition p-1 rounded-md hover:bg-white/10"
                          title={t('image.copyPrompt')}
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={togglePromptSave}
                          disabled={promptSaved === 'saving'}
                          className={`transition p-1 rounded-md hover:bg-white/10 ${promptSaved === 'error' ? 'text-red-400' : savedPromptId ? 'text-white' : 'text-white/30 hover:text-white/70'}`}
                          title={savedPromptId ? t('image.unsave') : t('image.savePrompt')}
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill={savedPromptId ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="max-h-[150px] overflow-y-auto pr-1 scrollbar-thin">
                      <p className="text-[13px] text-white/90 leading-relaxed whitespace-pre-wrap">{selected.prompt}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-4 opacity-40">
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{t('image.prompt')}</h3>
                    <p className="text-[13px] text-white/50 italic">{t('image.promptEmpty')}</p>
                  </div>
                )}

                {/* Palette */}
                {colors.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3 pr-4">
                      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{t('image.palette')}</h3>
                      <button
                        type="button"
                        onClick={togglePaletteSave}
                        disabled={paletteSaved === 'saving'}
                        className={`transition p-1 rounded-md hover:bg-white/10 ${paletteSaved === 'error' ? 'text-red-400' : savedPaletteId ? 'text-white' : 'text-white/30 hover:text-white/70'}`}
                        title={savedPaletteId ? t('image.unsave') : t('image.savePalette')}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill={savedPaletteId ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {colors.map((c, i) => {
                        if (!c) return null;
                        const isHovered = modalHoveredColor === i;
                        return (
                          <div
                            key={`vpanel-color-${c}-${i}`}
                            className={`rounded-full shadow-lg cursor-pointer transition-all duration-150 ${isHovered ? 'border border-white scale-110' : 'border border-white/30'}`}
                            style={{ backgroundColor: c, width: 28, height: 28 }}
                            title={c}
                            onMouseEnter={() => setModalHoveredColor(i)}
                            onMouseLeave={() => setModalHoveredColor(null)}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Description */}
                {selected.description && (
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{t('image.description')}</h3>
                    <p className="text-[13px] text-white/80 leading-relaxed">{selected.description}</p>
                  </div>
                )}

                {/* Author */}
                {SHOW_PUBLIC_AUTHOR_IDENTITY && (
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{t('image.author')}</h3>
                    <Link href={`/u/${encodeURIComponent(nick)}`} className="inline-flex items-center gap-2.5 rounded-full bg-white/5 px-3 py-1.5 transition hover:bg-white/10">
                      {avatar && <img src={avatar} alt={nick} className="h-6 w-6 rounded-full object-cover ring-1 ring-white/30" />}
                      <span className="text-sm text-white font-medium">{nick}</span>
                    </Link>
                  </div>
                )}

                {/* Model */}
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{t('image.model')}</h3>
                  <button type="button" onClick={() => { window.location.href = `/?t=video&models=${encodeURIComponent(selected.model || '')}`; }} className="inline-block rounded-full bg-white/5 px-3 py-1 text-sm font-mono text-white/80 transition hover:bg-white/20 cursor-pointer">{formatModelName(selected.model)}</button>
                </div>

                {/* Format */}
                {selected.aspect_ratio && (
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{t('image.format')}</h3>
                    <span className="inline-block rounded-full bg-white/5 px-3 py-1 text-sm font-mono text-white/80">{selected.aspect_ratio}</span>
                  </div>
                )}

                {/* Date */}
                {selected.created_at && (
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{t('image.date')}</h3>
                    <span className="text-sm text-white/60">{new Date(selected.created_at).toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" })}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right page — video */}
            <div className="relative flex flex-1 items-center">
              <div className={`relative flex flex-1 flex-col items-center justify-center overflow-hidden ${showPrompt ? "rounded-r-xl rounded-l-none" : "rounded-xl"} shadow-2xl w-full`}>
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
                  <div className="flex items-center justify-center bg-neutral-900 text-center text-gray-400" style={{ width: "min(85vw, 960px)", aspectRatio: "16/9" }}>
                    {selected.status === "processing" ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        <p>{t('video.processing')}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <p>{t('video.unavailable')}</p>
                        <p className="text-xs opacity-50">{t('video.tryReupload')}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Desktop timeline */}
                {selected.playback_id && (
                  <div
                    ref={extTimelineRef}
                    className="cursor-pointer"
                    style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden", transition: "height 0.15s ease", flexShrink: 0 }}
                    onMouseEnter={(e) => { e.currentTarget.style.height = "6px"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.height = "3px"; }}
                    onMouseDown={handleTimelineSeek}
                  >
                    <div ref={extFillRef} style={{ height: "100%", width: 0, background: "rgba(255,255,255,0.35)" }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Controls under video when info panel is open */}
          {showPrompt && (
            <div className="flex justify-between w-full" style={{ paddingLeft: 340 }}>
              <div className="flex gap-3 px-3 mt-3 w-full justify-center">
                {renderPlayBtn()}
                {renderMuteBtn()}
              </div>
            </div>
          )}

          {/* Info bar (hidden when info panel open) */}
          <div className={`mt-3 flex justify-center transition-opacity duration-300 ${showPrompt ? "opacity-0 pointer-events-none" : ""}`} onClick={(e) => e.stopPropagation()}>
            <div className="relative inline-flex">
              <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 flex items-center gap-3">
                {renderPlayBtn()}
                {renderMuteBtn()}
              </div>

              <div className="inline-flex items-center gap-4 rounded-full pl-1.5 pr-6 py-1.5 text-sm text-white" style={{ minWidth: 480, ...glassStyle }}>
                {selected.color_mode !== "none" && colors.length > 0 && (
                  <div className="group/dots flex-shrink-0 flex items-center pl-1">
                    {colors.map((c, index) => (
                      <div
                        key={`infobar-color-${index}`}
                        className="transition-all duration-300 rounded-full"
                        style={{
                          width: 22, height: 22, backgroundColor: c,
                          border: "1px solid rgba(255,255,255,0.15)",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                          marginLeft: index > 0 ? -6 : 0,
                          zIndex: 5 - index,
                        }}
                        title={c}
                      />
                    ))}
                  </div>
                )}

                {selected.title && (
                  <span className="text-xs font-semibold text-white truncate max-w-[200px]" title={selected.title}>{selected.title}</span>
                )}

                <button
                  type="button"
                  onClick={() => setShowPrompt(true)}
                  className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 transition hover:bg-white/30 text-white font-medium text-xs"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  {t('image.prompt')}
                </button>

                {SHOW_PUBLIC_AUTHOR_IDENTITY && (
                  <Link href={`/u/${encodeURIComponent(nick)}`} className="flex items-center gap-2 transition hover:opacity-80">
                    {avatar && <img src={avatar} alt={nick} className="h-5 w-5 rounded-full object-cover ring-1 ring-white/30" />}
                    <span className="text-white font-medium text-xs">{nick}</span>
                  </Link>
                )}

                <button type="button" onClick={() => { window.location.href = `/?t=video&models=${encodeURIComponent(selected.model || '')}`; }} className="font-mono text-xs uppercase tracking-wider text-white/70 transition hover:text-white hover:bg-white/20 rounded-full px-2 py-0.5 cursor-pointer">{formatModelName(selected.model)}</button>
              </div>
            </div>
          </div>
        </div>

        {/* Right side buttons (desktop) */}
        <div className="flex flex-col items-center self-stretch gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/film/${selected.id}`;
              navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
            }}
            className={`flex h-14 w-14 items-center justify-center rounded-xl transition ${copied ? "bg-green-500/80 text-white" : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"}`}
            title={copied ? t('image.copiedExcl') : t('image.share')}
          >
            {copied ? (
              <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            )}
          </button>

          <LikeButton
            target="film"
            id={selected.id}
            userId={userId}
            ownerId={selected.author_id}
            className="!h-14 !w-14 !rounded-xl !bg-white/10 !text-white/70 hover:!bg-white/20 hover:!text-white !backdrop-blur-none [&_svg]:!h-7 [&_svg]:!w-7"
          />

          <button
            type="button"
            onClick={() => setShowPrompt((v) => !v)}
            className={`flex h-14 w-14 items-center justify-center rounded-xl transition ${showPrompt ? "bg-white/30 text-white" : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"}`}
            title={t('image.info')}
          >
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
