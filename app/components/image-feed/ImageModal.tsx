"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import LikeButton from "../LikeButton";
import PromptModal from "../PromptModal";
import { formatModelName, formatDate } from "./utils";
import type { ImageRow, ImageVariant } from "./types";

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
  const [slideIndex, setSlideIndex] = useState(0);
  const [modalHoveredColor, setModalHoveredColor] = useState<number | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showPromptOverlay, setShowPromptOverlay] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageWidth, setImageWidth] = useState<number | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Mobile bottom sheet state
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [promptCopiedMobile, setPromptCopiedMobile] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const touchCurrentY = useRef<number | null>(null);
  const [sheetDragOffset, setSheetDragOffset] = useState(0);

  // Horizontal swipe for image navigation
  const imgTouchStartX = useRef<number | null>(null);
  const imgTouchStartY = useRef<number | null>(null);
  const imgSwiping = useRef(false);

  const currentVariant: ImageVariant | null =
    variants.length ? variants[slideIndex] ?? variants[0] : null;

  const currentColors =
    currentVariant?.colors && currentVariant.colors.length
      ? currentVariant.colors
      : selected.colors ?? [];

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

  const copyPromptMobile = async () => {
    try {
      await navigator.clipboard.writeText(selected.prompt || '');
      setPromptCopiedMobile(true);
      setTimeout(() => setPromptCopiedMobile(false), 2000);
    } catch { /* ignore */ }
  };

  const renderTagName = (tagWithLang: string) => {
    let tagId = tagWithLang;
    let lang: 'ru' | 'en' = 'ru';
    if (tagWithLang.endsWith(':en')) { tagId = tagWithLang.slice(0, -3); lang = 'en'; }
    else if (tagWithLang.endsWith(':ru')) { tagId = tagWithLang.slice(0, -3); lang = 'ru'; }
    const tagNames = tagsMap[tagId];
    return tagNames ? tagNames[lang] : tagId;
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
      onNavigate(images[targetIdx]);
    }
  }, [images, onNavigate, selected.id]);

  // --- Image horizontal swipe handlers ---
  const handleImgTouchStart = useCallback((e: React.TouchEvent) => {
    imgTouchStartX.current = e.touches[0].clientX;
    imgTouchStartY.current = e.touches[0].clientY;
    imgSwiping.current = false;
  }, []);

  const handleImgTouchMove = useCallback((e: React.TouchEvent) => {
    if (imgTouchStartX.current === null || imgTouchStartY.current === null) return;
    const dx = Math.abs(e.touches[0].clientX - imgTouchStartX.current);
    const dy = Math.abs(e.touches[0].clientY - imgTouchStartY.current);
    // If horizontal movement is dominant, mark as swiping
    if (dx > dy && dx > 10) imgSwiping.current = true;
  }, []);

  const handleImgTouchEnd = useCallback((e: React.TouchEvent) => {
    if (imgTouchStartX.current === null) return;
    const endX = e.changedTouches[0].clientX;
    const deltaX = imgTouchStartX.current - endX;
    const threshold = 60;

    if (imgSwiping.current) {
      if (deltaX > threshold) goToImage('next');
      else if (deltaX < -threshold) goToImage('prev');
    }

    imgTouchStartX.current = null;
    imgTouchStartY.current = null;
    imgSwiping.current = false;
  }, [goToImage]);

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

  // Lock body scroll on mobile when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>

      {/* ==================== MOBILE VERSION ==================== */}
      <div className="sm:hidden fixed inset-0 z-50 flex flex-col bg-black" onClick={(e) => e.stopPropagation()}>
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

        {/* Like button */}
        <div className="absolute top-3 left-3 z-30">
          <LikeButton
            target="image"
            id={selected.id}
            userId={userId}
            ownerId={selected.user_id}
            className="!h-9 !w-9 !rounded-full !bg-black/50 !text-white !backdrop-blur-sm [&_svg]:!h-5 [&_svg]:!w-5"
          />
        </div>

        {/* Image area — takes remaining space */}
        <div
          className="relative flex items-center justify-center flex-1 min-h-0"
          onTouchStart={handleImgTouchStart}
          onTouchMove={handleImgTouchMove}
          onTouchEnd={handleImgTouchEnd}
        >
          {currentVariant ? (
            <>
              <div className="relative inline-flex w-full h-full items-center justify-center">
                <img
                  ref={imageRef}
                  src={publicImageUrl(currentVariant.path)}
                  alt={(selected.title ?? "").trim() || "\u041A\u0430\u0440\u0442\u0438\u043D\u043A\u0430"}
                  className="max-w-full max-h-full object-contain"
                  onLoad={() => { if (imageRef.current) setImageWidth(imageRef.current.offsetWidth); }}
                />

                {/* Color marker on image */}
                {modalHoveredColor !== null && selected.color_positions && selected.color_positions[modalHoveredColor] && (() => {
                  const pos = selected.color_positions[modalHoveredColor];
                  const color = currentColors[modalHoveredColor] ?? pos.hex;
                  return (
                    <div
                      className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 transition-all duration-150"
                      style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
                    >
                      <div className="w-7 h-7 rounded-full border-[1.5px] border-white" style={{ backgroundColor: color, boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }} />
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
            <p className="text-sm text-white/60 p-8">{"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435."}</p>
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
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{"\u041F\u0440\u043E\u043C\u0442"}</h3>
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
                          {"\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u043E"}
                        </>
                      ) : (
                        <>
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                          {"\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C"}
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[13px] text-white/80 leading-relaxed whitespace-pre-wrap">{selected.prompt}</p>
                </div>
              )}

              {/* Description */}
              {selected.description && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{"\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435"}</h3>
                  <p className="text-[13px] text-white/70 leading-relaxed">{selected.description}</p>
                </div>
              )}

              {/* Colors */}
              {Array.isArray(currentColors) && currentColors.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{"\u0426\u0432\u0435\u0442\u0430"}</h3>
                  <div className="flex items-center gap-2">
                    {currentColors.map((c, index) => {
                      if (!c) return null;
                      const isActive = modalHoveredColor === index;
                      return (
                        <button
                          key={`sheet-${c}-${index}`}
                          type="button"
                          onClick={() => setModalHoveredColor(isActive ? null : index)}
                          className={`rounded-full transition-all duration-150 ${isActive ? 'ring-2 ring-white scale-110' : 'ring-1 ring-white/30'}`}
                          style={{ backgroundColor: c, width: 32, height: 32 }}
                        />
                      );
                    })}
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

              {/* Model + Format row */}
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1">{"\u041C\u043E\u0434\u0435\u043B\u044C"}</h3>
                  <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-mono text-white/80">{formatModelName(selected.model)}</span>
                </div>
                {selected.aspect_ratio && (
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1">{"\u0424\u043E\u0440\u043C\u0430\u0442"}</h3>
                    <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-mono text-white/80">{selected.aspect_ratio}</span>
                  </div>
                )}
              </div>

              {/* Tags */}
              {selected.tags && selected.tags.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{"\u0422\u0435\u0433\u0438"}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.tags.map((t) => (
                      <span key={t} className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70">{renderTagName(t)}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Date */}
              {selected.created_at && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1">{"\u0414\u0430\u0442\u0430"}</h3>
                  <span className="text-sm text-white/50">{new Date(selected.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
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
                  title={`\u0410\u043A\u0446\u0435\u043D\u0442: ${c}`}
                />
              ))
            )}
            {currentColors.map((c, index) => {
              if (!c) return null;
              const isHovered = modalHoveredColor === index;
              return (
                <div
                  key={c + index}
                  className={`rounded-full shadow-lg cursor-pointer transition-all duration-150 ${isHovered ? 'border border-white' : 'border border-white/30'}`}
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
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{"\u041F\u0440\u043E\u043C\u0442"}</h3>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(selected.prompt || '');
                        const icon = document.getElementById('copy-prompt-icon');
                        const check = document.getElementById('copy-prompt-check');
                        if (icon && check) { icon.classList.add('hidden'); check.classList.remove('hidden'); setTimeout(() => { icon.classList.remove('hidden'); check.classList.add('hidden'); }, 1500); }
                      }}
                      className="text-white/30 hover:text-white/70 transition p-1 rounded-md hover:bg-white/10"
                      title="\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043F\u0440\u043E\u043C\u0442"
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
              ) : (
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 opacity-40">
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{"\u041F\u0440\u043E\u043C\u0442"}</h3>
                  <p className="text-[13px] text-white/50 italic">{"\u041F\u0440\u043E\u043C\u0442 \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D"}</p>
                </div>
              )}

              {/* Description */}
              {selected.description && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{"\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435"}</h3>
                  <p className="text-[13px] text-white/80 leading-relaxed">{selected.description}</p>
                </div>
              )}

              <hr className="border-white/10" />

              {/* Author */}
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{"\u0410\u0432\u0442\u043E\u0440"}</h3>
                <Link href={`/u/${encodeURIComponent(nick)}`} className="inline-flex items-center gap-2.5 rounded-full bg-white/5 px-3 py-1.5 transition hover:bg-white/10">
                  {avatar && <img src={avatar} alt={nick} className="h-6 w-6 rounded-full object-cover ring-1 ring-white/30" />}
                  <span className="text-sm text-white font-medium">{nick}</span>
                </Link>
              </div>

              {/* Model */}
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{"\u041C\u043E\u0434\u0435\u043B\u044C"}</h3>
                <span className="inline-block rounded-full bg-white/5 px-3 py-1 text-sm font-mono text-white/80">{formatModelName(selected.model)}</span>
              </div>

              {/* Format */}
              {selected.aspect_ratio && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{"\u0424\u043E\u0440\u043C\u0430\u0442"}</h3>
                  <span className="inline-block rounded-full bg-white/5 px-3 py-1 text-sm font-mono text-white/80">{selected.aspect_ratio}</span>
                </div>
              )}

              {/* Tags */}
              {selected.tags && selected.tags.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{"\u0422\u0435\u0433\u0438"}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.tags.map((t) => (
                      <span key={t} className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70">{renderTagName(t)}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Date */}
              {selected.created_at && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">{"\u0414\u0430\u0442\u0430"}</h3>
                  <span className="text-sm text-white/60">{new Date(selected.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right page wrapper */}
          <div className="relative">
            {/* Color circles — spine (when info panel open) */}
            {showPrompt && Array.isArray(currentColors) && currentColors.length > 0 && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full flex-col gap-2 flex items-end z-10" style={{ paddingRight: '4px' }}>
                {selected.accent_colors && selected.accent_colors.length > 0 && (
                  selected.accent_colors.map((c, index) => (
                    <div key={`accent-spine-${c}-${index}`} className="flex items-center gap-1">
                      <span className="text-[9px] font-mono text-white/50 uppercase">{c}</span>
                      <div className="w-6 h-[1px] bg-white/30" />
                      <div className="rounded-full border-2 border-white/30 shadow-lg flex-shrink-0" style={{ backgroundColor: c, width: 18, height: 18 }} title={`\u0410\u043A\u0446\u0435\u043D\u0442: ${c}`} />
                    </div>
                  ))
                )}
                {currentColors.map((c, index) => {
                  if (!c) return null;
                  const isHovered = modalHoveredColor === index;
                  return (
                    <div key={`spine-${c}-${index}`} className="flex items-center gap-1">
                      <span className={`text-[9px] font-mono uppercase transition-all duration-150 ${isHovered ? 'text-white/90' : 'text-white/50'}`}>{c}</span>
                      <div className={`w-8 h-[1px] transition-all duration-150 ${isHovered ? 'bg-white/60' : 'bg-white/30'}`} />
                      <div
                        className={`rounded-full shadow-lg cursor-pointer transition-all duration-150 flex-shrink-0 ${isHovered ? 'border border-white' : 'border border-white/30'}`}
                        style={{ backgroundColor: c, width: 28, height: 28 }}
                        title={c}
                        onMouseEnter={() => setModalHoveredColor(index)}
                        onMouseLeave={() => setModalHoveredColor(null)}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Image container */}
            <div className={`group relative flex max-h-[90vh] flex-col overflow-hidden ${showPrompt ? 'rounded-r-xl rounded-l-none' : 'rounded-xl'} shadow-2xl`}>
              {/* Image with overlay */}
              <div className="relative flex items-center justify-center bg-black flex-1">
                {currentVariant ? (
                  <>
                    <div className="relative inline-flex">
                      <img
                        src={publicImageUrl(currentVariant.path)}
                        alt={(selected.title ?? "").trim() || "\u041A\u0430\u0440\u0442\u0438\u043D\u043A\u0430"}
                        className="max-h-[90vh] max-w-full object-contain"
                      />

                      {/* Color marker on image */}
                      {modalHoveredColor !== null && selected.color_positions && selected.color_positions[modalHoveredColor] && (() => {
                        const pos = selected.color_positions[modalHoveredColor];
                        const color = currentColors[modalHoveredColor] ?? pos.hex;
                        return (
                          <div
                            className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 transition-all duration-150"
                            style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
                          >
                            <div className="w-7 h-7 rounded-full border-[1.5px] border-white" style={{ backgroundColor: color, boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }} />
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
                          title="\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0435 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435"
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
                      <div className="flex flex-wrap items-center gap-4 text-xs text-white/80">
                        <div className="flex flex-col items-center gap-0.5">
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
                            {"\u041F\u0440\u043E\u043C\u0442"}
                          </button>
                          {selected.created_at && (
                            <span className="text-[10px] text-white/50">{formatDate(selected.created_at)}</span>
                          )}
                        </div>
                        <Link href={`/u/${encodeURIComponent(nick)}`} className="flex items-center gap-1.5 rounded-full px-2 py-0.5 transition hover:bg-white/20">
                          {avatar && <img src={avatar} alt={nick} className="h-4 w-4 rounded-full object-cover ring-1 ring-white/40" />}
                          <span className="text-white">{nick}</span>
                        </Link>
                        <span className="font-mono text-[11px] uppercase tracking-wider text-white/70">{formatModelName(selected.model)}</span>
                        {selected.tags && selected.tags.length > 0 && (
                          <>
                            {selected.tags.slice(0, 3).map((t) => (
                              <span key={t} className="rounded-full bg-white/20 px-2 py-0.5">{renderTagName(t)}</span>
                            ))}
                            {selected.tags.length > 3 && (
                              <span className="text-white/60">+{selected.tags.length - 3}</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-white/60 p-8">{"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435."}</p>
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
            title={copied ? '\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u043E!' : '\u041F\u043E\u0434\u0435\u043B\u0438\u0442\u044C\u0441\u044F'}
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
            title="\u0418\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044F"
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
