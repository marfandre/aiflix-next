"use client";

import { memo, useState } from "react";
import Link from "next/link";
import LikeButton from "../LikeButton";
import ColorChart from "./ColorChart";
import type { ImageRow } from "./types";

type Props = {
  image: ImageRow;
  userId: string | null;
  showAuthor: boolean;
  isOwnerView: boolean;
  deletingId: string | null;
  publicImageUrl: (path: string) => string;
  onOpen: (im: ImageRow) => void;
  onDelete: (id: string, path: string, e: React.MouseEvent) => void;
};

function ImageCard({
  image: im, userId, showAuthor, isOwnerView,
  deletingId, publicImageUrl, onOpen, onDelete,
}: Props) {
  const [expandedChart, setExpandedChart] = useState(false);
  const [hoveredColorIndex, setHoveredColorIndex] = useState<number | null>(null);

  const p = Array.isArray(im.profiles) ? im.profiles[0] : im.profiles;
  const nick: string = p?.username ?? "user";
  const avatar: string | null = p?.avatar_url ?? null;
  const url = publicImageUrl(im.path);
  const title = (im.title ?? "").trim() || "\u041A\u0430\u0440\u0442\u0438\u043D\u043A\u0430";
  const imagesCount = typeof im.images_count === "number" ? im.images_count : 1;
  const showCarouselBadge = imagesCount > 1;

  return (
    <div className="group relative mb-1">
      <button
        type="button"
        onClick={() => onOpen(im)}
        className="relative block w-full overflow-hidden bg-gray-100"
        style={{ aspectRatio: 'auto', minHeight: '0', maxHeight: '500px' }}
      >
        <img
          src={url}
          alt={title}
          className="w-full h-full transition-transform duration-300 group-hover:scale-105"
          style={{ objectFit: 'cover', objectPosition: 'center', minHeight: '180px', maxHeight: '500px' }}
        />

        {/* Color marker on image when hovering chart segment */}
        {hoveredColorIndex !== null && im.color_positions && im.color_positions[hoveredColorIndex] && (() => {
          const pos = im.color_positions[hoveredColorIndex];
          const color = im.colors?.[hoveredColorIndex] ?? pos.hex;
          return (
            <div
              className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 transition-all duration-150"
              style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
            >
              <div
                className="w-6 h-6 rounded-full border-[1.5px] border-white"
                style={{ backgroundColor: color, boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
              />
            </div>
          );
        })()}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Carousel badge */}
        {showCarouselBadge && (
          <div className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
            {imagesCount}
          </div>
        )}

        {/* Color chart */}
        {im.colors && im.colors.length > 0 && (
          <ColorChart
            imageId={im.id}
            colors={im.colors}
            accentColors={im.accent_colors ?? undefined}
            isExpanded={expandedChart}
            hoveredColorIndex={hoveredColorIndex}
            onToggleExpand={() => setExpandedChart(v => !v)}
            onHoverColor={setHoveredColorIndex}
          />
        )}

        {/* Author on hover */}
        {showAuthor && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <Link
              href={`/u/${encodeURIComponent(nick)}`}
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto flex items-center gap-1.5 rounded-full px-2 py-1 text-white transition hover:bg-white/20"
            >
              {avatar && (
                <img src={avatar} alt={nick} className="h-[18px] w-[18px] shrink-0 rounded-full object-cover ring-1 ring-white/40" />
              )}
              <span className="font-ui truncate text-[11px] font-medium drop-shadow-md">{nick}</span>
            </Link>
          </div>
        )}

        {/* Like button on hover */}
        <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <LikeButton target="image" id={im.id} userId={userId} ownerId={im.user_id} className="text-white drop-shadow-md" />
          </div>
        </div>

        {/* Edit / Delete for owner */}
        {isOwnerView && (
          <div className="pointer-events-none absolute top-2 right-2 flex gap-1.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); window.location.href = `/images/${im.id}/edit`; }}
              className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
              title="\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => onDelete(im.id, im.path, e)}
              disabled={deletingId === im.id}
              className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-600 disabled:opacity-50"
              title="\u0423\u0434\u0430\u043B\u0438\u0442\u044C"
            >
              {deletingId === im.id ? (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              )}
            </button>
          </div>
        )}
      </button>
    </div>
  );
}

export default memo(ImageCard);
