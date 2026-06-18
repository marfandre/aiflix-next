"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import LikeButton from "../LikeButton";
import PromptModal from "../PromptModal";
import { formatModelName, formatDate } from "./utils";
import type { ImageRow, ImageVariant } from "./types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  imageAspectLandingHref,
  imageColorLandingHref,
  imageModelLandingHref,
  imageTagLandingHref,
} from "@/app/images/_lib/seoLinks";

type Props = {
  selected: ImageRow;
  variants: ImageVariant[];
  variantsLoading: boolean;
  tagsMap: Record<string, { ru: string; en: string }>;
  userId: string | null;
  publicImageUrl: (path: string) => string;
  onClose: () => void;
  images?: ImageRow[];
  onNavigate?: (image: ImageRow) => void;
};

export default function ImageModal({
  selected, variants, variantsLoading, tagsMap, userId, publicImageUrl, onClose,
  images, onNavigate,
}: Props) {
  const { t, locale } = useI18n();
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'en-US';
  const [slideIndex, setSlideIndex] = useState(0);
  const [modalHoveredColor, setModalHoveredColor] = useState<number | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showPromptOverlay, setShowPromptOverlay] = useState(false);
  const [copied, setCopied] = useState(false);
  const [promptSaved, setPromptSaved] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [savedPromptId, setSavedPromptId] = useState<string | null>(null);
  const [paletteSaved, setPaletteSaved] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [savedPaletteId, setSavedPaletteId] = useState<string | null>(null);
  const [imageWidth, setImageWidth] = useState<number | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Bottom bar: how many tags fit based on image width

  // Mobile bottom sheet state
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [promptCopiedMobile, setPromptCopiedMobile] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const touchCurrentY = useRef<number | null>(null);
  const [sheetDragOffset, setSheetDragOffset] = useState(0);

  // Swipe gestures (horizontal = navigate, vertical down = close)
  const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0 });
  const [swipeClosing, setSwipeClosing] = useState(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swipeDir = useRef<"horizontal" | "vertical" | null>(null);

  const currentVariant: ImageVariant | null =
    variants.length ? variants[slideIndex] ?? variants[0] : null;

  const currentColors =
    currentVariant?.colors && currentVariant.colors.length
      ? currentVariant.colors
      : selected.colors ?? [];
  const colorFamilyAt = (index: number) => selected.color_families?.[index] ?? null;

  const hasCarousel = !variantsLoading && variants.length > 1;

  const shareImage = async () => {
    const shareUrl = `${window.location.origin}/images/${selected.id}`;
    if (navigator.share) {
      try { await navigator.share({ url: shareUrl }); return; } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Проверяем, сохранены ли промт и палитра этой картинки
  useEffect(() => {
    let cancelled = false;
    setSavedPromptId(null);
    setSavedPaletteId(null);
    if (!selected.id) return;
    (async () => {
      try {
        const [pRes, plRes] = await Promise.all([
          fetch(`/api/saved-prompts/check?source_type=image&source_id=${encodeURIComponent(selected.id)}`),
          fetch(`/api/saved-palettes/check?source_type=image&source_id=${encodeURIComponent(selected.id)}`),
        ]);
        if (!cancelled && pRes.ok) {
          const j = await pRes.json();
          setSavedPromptId(j?.id ?? null);
        }
        if (!cancelled && plRes.ok) {
          const j = await plRes.json();
          setSavedPaletteId(j?.id ?? null);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [selected.id]);

  const togglePromptSave = async () => {
    if (!selected.prompt || promptSaved === 'saving') return;
    setPromptSaved('saving');

    // Уже сохранено — удаляем
    if (savedPromptId) {
      try {
        const res = await fetch(`/api/saved-prompts/${savedPromptId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('delete failed');
        setSavedPromptId(null);
        setPromptSaved('idle');
      } catch {
        setPromptSaved('error');
        setTimeout(() => setPromptSaved('idle'), 2000);
      }
      return;
    }

    // Не сохранено — создаём
    try {
      const res = await fetch('/api/saved-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: selected.prompt,
          model: selected.model ?? null,
          seed: selected.seed ?? null,
          aspect_ratio: selected.aspect_ratio ?? null,
          source_type: 'image',
          source_id: selected.id,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (res.status === 401) { alert(t('image.signInToSavePrompt')); setPromptSaved('idle'); return; }
        throw new Error(j?.error || t('image.errorGeneric'));
      }
      const j = await res.json();
      setSavedPromptId(j?.id ?? null);
      setPromptSaved('idle');
    } catch {
      setPromptSaved('error');
      setTimeout(() => setPromptSaved('idle'), 2000);
    }
  };

  const togglePaletteSave = async () => {
    const colors = (currentColors || []).filter((c): c is string => !!c);
    if (colors.length === 0 || paletteSaved === 'saving') return;
    setPaletteSaved('saving');

    // Уже сохранено — удаляем
    if (savedPaletteId) {
      try {
        const res = await fetch(`/api/saved-palettes/${savedPaletteId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('delete failed');
        setSavedPaletteId(null);
        setPaletteSaved('idle');
      } catch {
        setPaletteSaved('error');
        setTimeout(() => setPaletteSaved('idle'), 2000);
      }
      return;
    }

    // Не сохранено — создаём
    try {
      const res = await fetch('/api/saved-palettes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colors: colors.slice(0, 10),
          source_type: 'image',
          source_id: selected.id,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (res.status === 401) { alert(t('image.signInToSavePalette')); setPaletteSaved('idle'); return; }
        throw new Error(j?.error || t('image.errorGeneric'));
      }
      const j = await res.json();
      setSavedPaletteId(j?.id ?? null);
      setPaletteSaved('idle');
    } catch {
      setPaletteSaved('error');
      setTimeout(() => setPaletteSaved('idle'), 2000);
    }
  };

  const copyPromptMobile = async () => {
    try {
      await navigator.clipboard.writeText(selected.prompt || '');
      setPromptCopiedMobile(true);
      setTimeout(() => setPromptCopiedMobile(false), 2000);
    } catch { /* ignore */ }
  };

  const renderTagName = (tagWithLang: string) => {
    let tagId = tagWithLang;
    if (tagWithLang.endsWith(':en') || tagWithLang.endsWith(':ru')) {
      tagId = tagWithLang.slice(0, -3);
    }
    return tagId;
  };

  const profile = Array.isArray(selected.profiles) ? selected.profiles[0] : selected.profiles;
  const nick: string = profile?.username ?? "user";
  const avatar: string | null = profile?.avatar_url ?? null;

  // --- Navigate to prev/next image ---
  const currentIndex = images ? images.findIndex(im => im.id === selected.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = images ? currentIndex < images.length - 1 : false;

  const goToImage = useCallback((direction: 'prev' | 'next') => {
    if (!images || !onNavigate) return;
    const idx = images.findIndex(im => im.id === selected.id);
    const targetIdx = direction === 'prev' ? idx - 1 : idx + 1;
    if (targetIdx >= 0 && targetIdx < images.length) {
      setSheetExpanded(false);
      setModalHoveredColor(null);
      setImageWidth(null);
      onNavigate(images[targetIdx]);
    }
  }, [images, onNavigate, selected.id]);

  // --- Image swipe handlers (with visual feedback + swipe-down-to-close) ---
  const handleImgTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeStart.current = { x: t.clientX, y: t.clientY };
    swipeDir.current = null;
    setSwipeOffset({ x: 0, y: 0 });
  }, []);

  const handleImgTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeStart.current) return;
    const t = e.touches[0];
    const dx = t.clientX - swipeStart.current.x;
    const dy = t.clientY - swipeStart.current.y;

    // Lock direction after 10px movement
    if (!swipeDir.current) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        swipeDir.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      } else {
        return;
      }
    }

    if (swipeDir.current === "horizontal") {
      const resist = (dx > 0 && !hasPrev) || (dx < 0 && !hasNext) ? 0.3 : 1;
      setSwipeOffset({ x: dx * resist, y: 0 });
    } else {
      // Only swipe down
      setSwipeOffset({ x: 0, y: Math.max(0, dy) });
    }
  }, [hasPrev, hasNext]);

  const handleImgTouchEnd = useCallback(() => {
    if (!swipeStart.current) return;
    const { x: ox, y: oy } = swipeOffset;
    const threshold = 80;

    if (swipeDir.current === "horizontal") {
      if (ox < -threshold && hasNext) goToImage('next');
      else if (ox > threshold && hasPrev) goToImage('prev');
    } else if (swipeDir.current === "vertical") {
      if (oy > threshold) {
        setSwipeClosing(true);
        setTimeout(onClose, 200);
        return;
      }
    }

    swipeStart.current = null;
    swipeDir.current = null;
    setSwipeOffset({ x: 0, y: 0 });
  }, [swipeOffset, hasPrev, hasNext, goToImage, onClose]);

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
      // When expanded, only allow dragging down (negative delta = swipe down)
      if (delta < 0) {
        setSheetDragOffset(delta);
      }
    } else {
      // When collapsed, only allow dragging up (positive delta = swipe up)
      if (delta > 0) {
        setSheetDragOffset(delta);
      }
    }
  }, [sheetExpanded]);

  const handleTouchEnd = useCallback(() => {
    if (touchStartY.current === null || touchCurrentY.current === null) return;
    const delta = touchStartY.current - touchCurrentY.current;
    const threshold = 60;

    if (sheetExpanded) {
      if (delta < -threshold) {
        setSheetExpanded(false);
        setModalHoveredColor(null); // Reset color marker when collapsing
      }
    } else {
      if (delta > threshold) {
        setSheetExpanded(true);
      }
    }

    touchStartY.current = null;
    touchCurrentY.current = null;
    setSheetDragOffset(0);
  }, [sheetExpanded]);

  // Track actual rendered image bounds for accurate color markers
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const [imgBounds, setImgBounds] = useState<{ ox: number; oy: number; w: number; h: number } | null>(null);

  const recalcImgBounds = useCallback(() => {
    const img = imageRef.current;
    const container = imgContainerRef.current;
    if (!img || !container) { setImgBounds(null); return; }

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) { setImgBounds(null); return; }

    const scale = Math.min(cw / nw, ch / nh);
    const rw = nw * scale;
    const rh = nh * scale;
    const ox = (cw - rw) / 2;
    const oy = (ch - rh) / 2;
    setImgBounds({ ox, oy, w: rw, h: rh });
  }, []);

  useEffect(() => {
    const container = imgContainerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => recalcImgBounds());
    ro.observe(container);
    return () => ro.disconnect();
  }, [recalcImgBounds]);

  // Recalc on image load and when sheet expands/collapses
  useEffect(() => {
    // Small delay to let CSS transition finish
    const t = setTimeout(recalcImgBounds, 350);
    return () => clearTimeout(t);
  }, [sheetExpanded, recalcImgBounds]);

  // Lock body scroll on mobile when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // How many tags fit in the bottom bar based on image width
  // ~350px for prompt+author+model+gaps, ~80px per tag, ~30px for "+N"
  const barTagCount = imageWidth ? Math.max(0, Math.floor((imageWidth - 380) / 80)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>

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
            : swipeDir.current === "vertical"
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


        {/* Image area — takes remaining space */}
        <div
          className="relative flex items-center justify-center flex-1 min-h-0"
          onTouchStart={handleImgTouchStart}
          onTouchMove={handleImgTouchMove}
          onTouchEnd={handleImgTouchEnd}
          style={{
            transform: swipeOffset.x !== 0 ? `translateX(${swipeOffset.x}px)` : undefined,
            opacity: swipeOffset.x !== 0 ? Math.max(0.5, 1 - Math.abs(swipeOffset.x) / 400) : 1,
            transition: swipeDir.current === "horizontal" ? "none" : "transform 0.3s ease-out, opacity 0.3s ease-out",
          }}
        >
          {currentVariant ? (
            <>
              <div ref={imgContainerRef} className="relative inline-flex w-full h-full items-center justify-center">
                <img
                  ref={imageRef}
                  src={publicImageUrl(currentVariant.path)}
                  alt={(selected.title ?? "").trim() || t('image.fallbackTitle')}
                  className="max-w-full max-h-full object-contain"
                  onLoad={() => {
                    if (imageRef.current) setImageWidth(imageRef.current.offsetWidth);
                    recalcImgBounds();
                  }}
                />

                {/* Color marker on image — pixel-positioned to match actual rendered image */}
                {modalHoveredColor !== null && currentColors[modalHoveredColor] && selected.color_positions && imgBounds && (() => {
                  const hoveredHex = currentColors[modalHoveredColor];
                  const pos = selected.color_positions.find(p => p.hex?.toLowerCase() === hoveredHex.toLowerCase());
                  if (!pos) return null;
                  const px = imgBounds.ox + pos.x * imgBounds.w;
                  const py = imgBounds.oy + pos.y * imgBounds.h;
                  return (
                    <div
                      className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 transition-all duration-150"
                      style={{ left: px, top: py }}
                    >
                      <div className="w-5 h-5 rounded-full border-[1.5px] border-white" style={{ backgroundColor: hoveredHex, boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }} />
                    </div>
                  );
                })()}
              </div>

              {/* Carousel arrows */}
              {hasCarousel && (
                <>
                  <button
                    type="button"
                    onClick={() => setSlideIndex((i) => (i - 1 + variants.length) % variants.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 backdrop-blur-sm"
                  >
                    <span className="block text-lg leading-none text-white">{"\u2039"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlideIndex((i) => (i + 1) % variants.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 backdrop-blur-sm"
                  >
                    <span className="block text-lg leading-none text-white">{"\u203A"}</span>
                  </button>
                  <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                    {variants.map((v, idx) => (
                      <button key={v.path + idx} type="button" onClick={() => setSlideIndex(idx)} className={`h-1.5 w-1.5 rounded-full ${idx === slideIndex ? "bg-white" : "bg-white/40"}`} />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-white/60 p-8">{t('image.loadFailed')}</p>
          )}
        </div>

        {/* Bottom sheet */}
        <div
          ref={sheetRef}
          className="relative bg-neutral-900 rounded-t-2xl transition-[max-height] duration-300 ease-out flex-shrink-0 flex flex-col overflow-hidden"
          style={{
            maxHeight: sheetExpanded ? '70vh' : '110px',
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

          {/* Collapsed state: author row + prompt preview */}
          <div className="px-4 pb-3">
            {/* Author + action buttons */}
            <div className="flex items-center justify-between mb-2">
              <Link
                href={`/u/${encodeURIComponent(nick)}`}
                className="flex items-center gap-2 min-w-0"
              >
                {avatar && <img src={avatar} alt={nick} className="h-7 w-7 rounded-full object-cover ring-1 ring-white/30 flex-shrink-0" />}
                <span className="text-sm text-white font-medium truncate">{nick}</span>
              </Link>

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Like */}
                <LikeButton
                  target="image"
                  id={selected.id}
                  userId={userId}
                  ownerId={selected.user_id}
                  className="!h-9 !w-9 !rounded-full !bg-white/10 !text-white/70 [&_svg]:!h-5 [&_svg]:!w-5"
                />
                {/* Share */}
                <button
                  type="button"
                  onClick={shareImage}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${copied ? 'bg-green-500/80 text-white' : 'bg-white/10 text-white/70'}`}
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
                  onClick={() => {
                    setSheetExpanded(v => {
                      if (v) setModalHoveredColor(null); // Reset color marker when collapsing
                      return !v;
                    });
                  }}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${sheetExpanded ? 'bg-white/25 text-white' : 'bg-white/10 text-white/70'}`}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Prompt preview (1 line, truncated) — hidden when expanded */}
            {selected.prompt && !sheetExpanded && (
              <p className="text-[13px] text-white/60 truncate">{selected.prompt}</p>
            )}
          </div>

          {/* Expanded content */}
          {sheetExpanded && (
            <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="px-4 pb-8 flex flex-col gap-4">
              {/* Separator */}
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
                        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition ${promptCopiedMobile ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/50'}`}
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
                        title={savedPromptId ? t('image.unsave') : t('image.savePrompt')}
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
              {Array.isArray(currentColors) && currentColors.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{t('image.palette')}</h3>
                    <button
                      type="button"
                      onClick={togglePaletteSave}
                      disabled={paletteSaved === 'saving'}
                      className={`flex h-7 w-7 items-center justify-center rounded-full transition ${paletteSaved === 'error' ? 'bg-red-500/20 text-red-400' : savedPaletteId ? 'bg-white/20 text-white' : 'bg-white/10 text-white/50'}`}
                      title={savedPaletteId ? t('image.unsave') : t('image.savePalette')}
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill={savedPaletteId ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentColors.map((c, index) => {
                      if (!c) return null;
                      const isActive = modalHoveredColor === index;
                      const family = colorFamilyAt(index);
                      const swatchClass = `rounded-full transition-all duration-150 flex-shrink-0 ${isActive ? 'ring-2 ring-white scale-110' : 'ring-1 ring-white/30'}`;
                      if (family) {
                        return (
                          <Link
                            key={`sheet-${c}-${index}`}
                            href={imageColorLandingHref(family)}
                            className={swatchClass}
                            style={{ backgroundColor: c, width: 32, height: 32 }}
                            title={`${c} (${family})`}
                            aria-label={`View ${family} AI images`}
                          />
                        );
                      }
                      return (
                        <button
                          key={`sheet-${c}-${index}`}
                          type="button"
                          onClick={() => setModalHoveredColor(isActive ? null : index)}
                          className={swatchClass}
                          style={{ backgroundColor: c, width: 32, height: 32 }}
                        />
                      );
                    })}
                    {/* Hex code of selected color */}
                    {modalHoveredColor !== null && currentColors[modalHoveredColor] && (
                      <span className="text-xs font-mono text-white/70 ml-1 uppercase">{currentColors[modalHoveredColor]}</span>
                    )}
                    {/* Accent colors */}
                    {selected.accent_colors && selected.accent_colors.length > 0 && (
                      <>
                        <div className="w-px h-5 bg-white/20 mx-1" />
                        {selected.accent_colors.map((c, index) => (
                          <div
                            key={`sheet-accent-${c}-${index}`}
                            className="rounded-full ring-1 ring-white/30"
                            style={{ backgroundColor: c, width: 24, height: 24 }}
                          />
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Source */}
              {selected.source && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1">{t('image.source')}</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    {selected.source_author && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/80">
                        <svg className="h-3 w-3 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        {selected.source_author}
                      </span>
                    )}
                    {selected.source_url && (
                      <a href={selected.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/60 transition hover:bg-white/20 hover:text-white/90">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        {selected.source === 'civitai' ? 'CivitAI' : selected.source}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Seed */}
              {selected.seed && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1">Seed</h3>
                  <span className="inline-block rounded-full bg-white/10 px-2.5 py-1 text-xs font-mono text-white/80">{selected.seed}</span>
                </div>
              )}

              {/* Model + Format row */}
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1">{t('image.model')}</h3>
                  {selected.model ? (
                    <Link
                      href={imageModelLandingHref(selected.model)}
                      className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-mono text-white/80 transition hover:bg-white/25"
                    >
                      {formatModelName(selected.model)}
                    </Link>
                  ) : (
                    <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-mono text-white/80">
                      {formatModelName(selected.model)}
                    </span>
                  )}
                </div>
                {selected.aspect_ratio && (
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1">{t('image.format')}</h3>
                    <Link
                      href={imageAspectLandingHref(selected.aspect_ratio)}
                      className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-mono text-white/80 transition hover:bg-white/25"
                    >
                      {selected.aspect_ratio}
                    </Link>
                  </div>
                )}
              </div>

              {/* Tags */}
              {selected.tags && selected.tags.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{t('image.tags')}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.tags.map((t) => (
                      <Link
                        key={t}
                        href={imageTagLandingHref(t)}
                        className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70 transition hover:bg-white/25"
                      >
                        {renderTagName(t)}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Date */}
              {selected.created_at && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1">{t('image.date')}</h3>
                  <span className="text-sm text-white/50">{new Date(selected.created_at).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>

      {/* ==================== DESKTOP VERSION (unchanged) ==================== */}
      <div className="hidden sm:flex items-center gap-3">
        {/* Color palette — left of modal (when info panel closed) */}
        {!showPrompt && Array.isArray(currentColors) && currentColors.length > 0 && (
          <div className="flex-col gap-2 flex items-center">
            {selected.accent_colors && selected.accent_colors.length > 0 && (
              selected.accent_colors.map((c, index) => (
                <div
                  key={`accent-${c}-${index}`}
                  className="rounded-full border-2 border-white/30 shadow-lg"
                  style={{ backgroundColor: c, width: 18, height: 18 }}
                  title={t('image.accentColor', { hex: c })}
                />
              ))
            )}
            {currentColors.map((c, index) => {
              if (!c) return null;
              const isHovered = modalHoveredColor === index;
              const family = colorFamilyAt(index);
              const className = `rounded-full shadow-lg cursor-pointer transition-all duration-150 ${isHovered ? 'border border-white' : 'border border-white/30'}`;
              if (family) {
                return (
                  <Link
                    key={c + index}
                    href={imageColorLandingHref(family)}
                    className={className}
                    style={{ backgroundColor: c, width: 28, height: 28 }}
                    title={`${c} (${family})`}
                    aria-label={`View ${family} AI images`}
                    onMouseEnter={() => setModalHoveredColor(index)}
                    onMouseLeave={() => setModalHoveredColor(null)}
                  />
                );
              }
              return (
                <div
                  key={c + index}
                  className={className}
                  style={{ backgroundColor: c, width: 28, height: 28 }}
                  title={c}
                  onMouseEnter={() => setModalHoveredColor(index)}
                  onMouseLeave={() => setModalHoveredColor(null)}
                />
              );
            })}
          </div>
        )}

        {/* Book container */}
        <div className="flex items-stretch max-w-[95vw] relative" onClick={(e) => e.stopPropagation()}>
          {/* Left page — info panel */}
          <div className={`flex overflow-hidden transition-all duration-300 ease-in-out ${showPrompt ? 'max-w-[340px] opacity-100' : 'max-w-0 opacity-0'}`}>
            <div className="w-[340px] h-full bg-neutral-900/70 backdrop-blur-xl rounded-l-xl p-6 flex flex-col gap-5 text-white overflow-y-auto scrollbar-thin" style={{ maxHeight: '90vh' }}>
              {/* Prompt */}
              {selected.prompt ? (
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 relative group/prompt">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{t('image.prompt')}</h3>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selected.prompt || '');
                          const icon = document.getElementById('copy-prompt-icon');
                          const check = document.getElementById('copy-prompt-check');
                          if (icon && check) { icon.classList.add('hidden'); check.classList.remove('hidden'); setTimeout(() => { icon.classList.remove('hidden'); check.classList.add('hidden'); }, 1500); }
                        }}
                        className="text-white/30 hover:text-white/70 transition p-1 rounded-md hover:bg-white/10"
                        title={t('image.copyPrompt')}
                      >
                        <svg id="copy-prompt-icon" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        <svg id="copy-prompt-check" className="h-4 w-4 hidden text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={togglePromptSave}
                        disabled={promptSaved === 'saving'}
                        className={`transition p-1 rounded-md hover:bg-white/10 ${
                          promptSaved === 'error' ? 'text-red-400' :
                          savedPromptId ? 'text-white' :
                          'text-white/30 hover:text-white/70'
                        }`}
                        title={savedPromptId ? t('image.unsave') : t('image.savePrompt')}
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill={savedPromptId ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
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
              {Array.isArray(currentColors) && currentColors.filter(Boolean).length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3 pr-4">
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{t('image.palette')}</h3>
                    <button
                      type="button"
                      onClick={togglePaletteSave}
                      disabled={paletteSaved === 'saving'}
                      className={`transition p-1 rounded-md hover:bg-white/10 ${
                        paletteSaved === 'error' ? 'text-red-400' :
                        savedPaletteId ? 'text-white' :
                        'text-white/30 hover:text-white/70'
                      }`}
                      title={savedPaletteId ? t('image.unsave') : t('image.savePalette')}
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill={savedPaletteId ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentColors.map((c, i) => {
                      if (!c) return null;
                      const isHovered = modalHoveredColor === i;
                      const family = colorFamilyAt(i);
                      const className = `rounded-full shadow-lg cursor-pointer transition-all duration-150 ${isHovered ? 'border border-white scale-110' : 'border border-white/30'}`;
                      if (family) {
                        return (
                          <Link
                            key={`panel-color-${c}-${i}`}
                            href={imageColorLandingHref(family)}
                            className={className}
                            style={{ backgroundColor: c, width: 28, height: 28 }}
                            title={`${c} (${family})`}
                            aria-label={`View ${family} AI images`}
                            onMouseEnter={() => setModalHoveredColor(i)}
                            onMouseLeave={() => setModalHoveredColor(null)}
                          />
                        );
                      }
                      return (
                        <div
                          key={`panel-color-${c}-${i}`}
                          className={className}
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
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{t('image.author')}</h3>
                <Link href={`/u/${encodeURIComponent(nick)}`} className="inline-flex items-center gap-2.5 rounded-full bg-white/5 px-3 py-1.5 transition hover:bg-white/10">
                  {avatar && <img src={avatar} alt={nick} className="h-6 w-6 rounded-full object-cover ring-1 ring-white/30" />}
                  <span className="text-sm text-white font-medium">{nick}</span>
                </Link>
              </div>

              {/* Source */}
              {selected.source && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{t('image.source')}</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    {selected.source_author && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-sm text-white/80">
                        <svg className="h-3.5 w-3.5 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        {selected.source_author}
                      </span>
                    )}
                    {selected.source_url && (
                      <a
                        href={selected.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-sm text-white/60 transition hover:bg-white/10 hover:text-white/90"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        {selected.source === 'civitai' ? 'CivitAI' : selected.source}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Seed */}
              {selected.seed && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">Seed</h3>
                  <span className="inline-block rounded-full bg-white/5 px-3 py-1 text-sm font-mono text-white/80">{selected.seed}</span>
                </div>
              )}

              {/* Model */}
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{t('image.model')}</h3>
                {selected.model ? (
                  <Link
                    href={imageModelLandingHref(selected.model)}
                    className="inline-block rounded-full bg-white/5 px-3 py-1 text-sm font-mono text-white/80 transition hover:bg-white/20"
                  >
                    {formatModelName(selected.model)}
                  </Link>
                ) : (
                  <span className="inline-block rounded-full bg-white/5 px-3 py-1 text-sm font-mono text-white/80">
                    {formatModelName(selected.model)}
                  </span>
                )}
              </div>

              {/* Format */}
              {selected.aspect_ratio && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{t('image.format')}</h3>
                  <Link
                    href={imageAspectLandingHref(selected.aspect_ratio)}
                    className="inline-block rounded-full bg-white/5 px-3 py-1 text-sm font-mono text-white/80 transition hover:bg-white/20"
                  >
                    {selected.aspect_ratio}
                  </Link>
                </div>
              )}

              {/* Tags */}
              {selected.tags && selected.tags.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{t('image.tags')}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.tags.map((t) => (
                      <Link
                        key={t}
                        href={imageTagLandingHref(t)}
                        className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70 transition hover:bg-white/25"
                      >
                        {renderTagName(t)}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Date */}
              {selected.created_at && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{t('image.date')}</h3>
                  <span className="text-sm text-white/60">{new Date(selected.created_at).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right page wrapper */}
          <div className="relative">
            {/* Image container */}
            <div className={`group relative flex max-h-[90vh] flex-col overflow-hidden ${showPrompt ? 'rounded-r-xl rounded-l-none' : 'rounded-xl'} shadow-2xl`}>
              {/* Image with overlay */}
              <div className="relative flex items-center justify-center bg-black flex-1">
                {currentVariant ? (
                  <>
                    <div className="relative inline-flex">
                      <img
                        src={publicImageUrl(currentVariant.path)}
                        alt={(selected.title ?? "").trim() || t('image.fallbackTitle')}
                        className="max-h-[90vh] max-w-full object-contain"
                        onLoad={(e) => setImageWidth((e.target as HTMLImageElement).offsetWidth)}
                      />

                      {/* Color marker on image */}
                      {modalHoveredColor !== null && currentColors[modalHoveredColor] && selected.color_positions && (() => {
                        const hoveredHex = currentColors[modalHoveredColor];
                        const pos = selected.color_positions.find(p => p.hex?.toLowerCase() === hoveredHex.toLowerCase());
                        if (!pos) return null;
                        return (
                          <div
                            className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 transition-all duration-150"
                            style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
                          >
                            <div className="w-7 h-7 rounded-full border-[1.5px] border-white" style={{ backgroundColor: hoveredHex, boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }} />
                          </div>
                        );
                      })()}
                    </div>

                    {/* Carousel arrows */}
                    {hasCarousel && (
                      <>
                        <button
                          type="button"
                          onClick={() => setSlideIndex((i) => (i - 1 + variants.length) % variants.length)}
                          className="group absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 shadow-sm backdrop-blur-sm hover:bg-black/60"
                          title={t('image.prev')}
                        >
                          <span className="block text-lg leading-none text-white transition-transform group-hover:-translate-x-0.5">{"\u2039"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSlideIndex((i) => (i + 1) % variants.length)}
                          className="group absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 shadow-sm backdrop-blur-sm hover:bg-black/60"
                        >
                          <span className="block text-lg leading-none text-white transition-transform group-hover:translate-x-0.5">{"\u203A"}</span>
                        </button>
                        <div className="absolute bottom-20 left-1/2 flex -translate-x-1/2 gap-1">
                          {variants.map((v, idx) => (
                            <button key={v.path + idx} type="button" onClick={() => setSlideIndex(idx)} className={`h-1.5 w-1.5 rounded-full ${idx === slideIndex ? "bg-white" : "bg-white/40"}`} />
                          ))}
                        </div>
                      </>
                    )}

                    {/* Prompt overlay */}
                    <PromptModal prompt={selected.prompt} description={selected.description} isOpen={showPromptOverlay} onClose={() => setShowPromptOverlay(false)} />

                    {/* Bottom bar */}
                    <div className={`absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-md py-1.5 px-3 border-t border-white/20 transition-opacity duration-300 ${showPrompt ? 'opacity-0 pointer-events-none' : ''}`}>
                      <div className="flex items-center gap-4 text-xs text-white/80 overflow-hidden">
                        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setShowPromptOverlay(true)}
                            className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 transition hover:bg-white/30 text-white"
                          >
                            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                            {t('image.prompt')}
                          </button>
                          {selected.created_at && (
                            <span className="text-[10px] text-white/50">{formatDate(selected.created_at)}</span>
                          )}
                        </div>
                        <Link href={`/u/${encodeURIComponent(nick)}`} className="flex items-center gap-1.5 rounded-full px-2 py-0.5 transition hover:bg-white/20 flex-shrink-0">
                          {avatar && <img src={avatar} alt={nick} className="h-4 w-4 rounded-full object-cover ring-1 ring-white/40" />}
                          <span className="text-white">{nick}</span>
                        </Link>
                        {selected.model ? (
                          <Link
                            href={imageModelLandingHref(selected.model)}
                            className="font-mono text-[11px] uppercase tracking-wider text-white/70 transition hover:text-white hover:bg-white/20 rounded-full px-2 py-0.5 flex-shrink-0"
                          >
                            {formatModelName(selected.model)}
                          </Link>
                        ) : (
                          <span className="font-mono text-[11px] uppercase tracking-wider text-white/70 rounded-full px-2 py-0.5 flex-shrink-0">
                            {formatModelName(selected.model)}
                          </span>
                        )}
                        {barTagCount > 0 && selected.tags && selected.tags.length > 0 && (() => {
                          const visible = selected.tags.slice(0, barTagCount);
                          const remaining = selected.tags.length - visible.length;
                          return (
                            <>
                              {visible.map((t) => (
                                <Link
                                  key={t}
                                  href={imageTagLandingHref(t)}
                                  className="rounded-full bg-white/20 px-2 py-0.5 transition hover:bg-white/35 flex-shrink-0"
                                >
                                  {renderTagName(t)}
                                </Link>
                              ))}
                              {remaining > 0 && (
                                <span className="text-white/60 flex-shrink-0">+{remaining}</span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-white/60 p-8">{t('image.loadFailed')}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons — right side */}
        <div className="flex flex-col items-center self-start gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={shareImage}
            className={`flex h-14 w-14 items-center justify-center rounded-xl transition ${copied ? 'bg-green-500/80 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'}`}
            title={copied ? t('image.copiedExcl') : t('image.share')}
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
          <LikeButton
            target="image"
            id={selected.id}
            userId={userId}
            ownerId={selected.user_id}
            className="!h-14 !w-14 !rounded-xl !bg-white/10 !text-white/70 hover:!bg-white/20 hover:!text-white !backdrop-blur-none [&_svg]:!h-7 [&_svg]:!w-7"
          />
          <button
            type="button"
            onClick={() => setShowPrompt((v) => !v)}
            className={`flex h-14 w-14 items-center justify-center rounded-xl transition ${showPrompt ? 'bg-white/30 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'}`}
            title={t('image.info')}
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
  );
}
