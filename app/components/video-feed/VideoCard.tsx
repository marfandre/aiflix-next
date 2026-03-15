"use client";

import { memo, useState, useRef } from "react";
import Link from "next/link";
import LikeButton from "../LikeButton";
import { muxPoster } from "./utils";
import type { VideoRow } from "./types";

type Props = {
  video: VideoRow;
  userId: string | null;
  showAuthor: boolean;
  isOwnerView: boolean;
  deletingId: string | null;
  onOpen: (v: VideoRow) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
};

function VideoCard({
  video: v, userId, showAuthor, isOwnerView,
  deletingId, onOpen, onDelete,
}: Props) {
  const [expandedChart, setExpandedChart] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hoverKey, setHoverKey] = useState(0);

  const p = Array.isArray(v.profiles) ? v.profiles[0] : v.profiles;
  const nick: string = p?.username ?? "user";
  const avatar: string | null = p?.avatar_url ?? null;
  const title = (v.title ?? "").trim() || "\u0411\u0435\u0437 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F";

  // Color chart helpers
  const staticColors = (v.colors ?? []).slice(0, 5);
  const showChart = v.color_mode !== "none" && staticColors.length > 0;

  const createSegmentPath = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
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
    <div
      className="group relative mb-1"
      onMouseEnter={() => { setHovered(true); setHoverKey(Date.now()); }}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={() => onOpen(v)}
        className="relative block w-full overflow-hidden bg-gray-100"
        style={{ aspectRatio: "3/4" }}
      >
        {/* Static poster */}
        <img
          src={muxPoster(v.playback_id)}
          alt={title}
          className="absolute inset-0 w-full h-full transition-transform duration-300 group-hover:scale-105"
          style={{ objectFit: "cover", objectPosition: "center top" }}
        />

        {/* WebP preview on hover */}
        {v.playback_id && hovered && (
          <img
            key={`webp-${v.id}-${hoverKey}`}
            src={`https://image.mux.com/${v.playback_id}/animated.webp?fps=15&width=640&t=${hoverKey}`}
            alt="Preview"
            className="absolute inset-0 w-full h-full z-10"
            style={{ objectFit: "cover", objectPosition: "center top" }}
          />
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Color chart */}
        {showChart && (() => {
          const isExpanded = expandedChart;
          const baseSize = isExpanded ? 64 : 20;
          const size = baseSize;
          const cx = size / 2;
          const cy = size / 2;
          const r = size / 2;
          const segmentAngle = 360 / staticColors.length;

          return (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setExpandedChart(v => !v); }}
              className="absolute bottom-2 right-2 z-20 rounded-full transition-all duration-300 cursor-pointer"
              style={{
                width: size, height: size,
                boxShadow: isExpanded
                  ? "0 4px 12px rgba(0,0,0,0.4), inset 0 1px 3px rgba(255,255,255,0.3)"
                  : "0 1px 3px rgba(0,0,0,0.3)",
              }}
              title={`\u041D\u0430\u0436\u043C\u0438\u0442\u0435 \u0447\u0442\u043E\u0431\u044B ${isExpanded ? "\u0441\u0432\u0435\u0440\u043D\u0443\u0442\u044C" : "\u0443\u0432\u0435\u043B\u0438\u0447\u0438\u0442\u044C"}`}
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
                  <path key={i} d={createSegmentPath(cx, cy, r, i * segmentAngle, (i + 1) * segmentAngle)} fill={color} />
                ))}
                {isExpanded && <circle cx={cx} cy={cy} r={r} fill={`url(#gloss-v-${v.id})`} pointerEvents="none" />}
                <circle cx={cx} cy={cy} r={r - 0.5} fill="none" stroke={isExpanded ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.5)"} strokeWidth={1} />
              </svg>
            </button>
          );
        })()}
      </button>

      {/* Author overlay */}
      {showAuthor && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <Link
            href={`/u/${encodeURIComponent(nick)}`}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full px-2 py-1 text-white transition hover:bg-white/20"
          >
            {avatar && <img src={avatar} alt={nick} className="h-[18px] w-[18px] shrink-0 rounded-full object-cover ring-1 ring-white/40" />}
            <span className="font-ui truncate text-[11px] font-medium drop-shadow-md">{nick}</span>
          </Link>
        </div>
      )}

      {/* Like button on hover */}
      <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="pointer-events-auto">
          <LikeButton target="film" id={v.id} userId={userId} ownerId={v.author_id} className="text-white drop-shadow-md" />
        </div>
      </div>

      {/* Edit / Delete for owner */}
      {isOwnerView && (
        <div className="pointer-events-none absolute top-2 right-2 z-30 flex gap-1.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); window.location.href = `/film/${v.id}/edit`; }}
            className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
            title="Редактировать"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => onDelete(v.id, e)}
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
}

export default memo(VideoCard);
