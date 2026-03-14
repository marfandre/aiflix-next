"use client";

import { memo } from "react";

type Props = {
  imageId: string;
  colors: string[];
  accentColors?: string[];
  isExpanded: boolean;
  hoveredColorIndex: number | null;
  onToggleExpand: () => void;
  onHoverColor: (index: number | null) => void;
};

function createSegmentPath(
  cx: number, cy: number,
  startAngle: number, endAngle: number, r: number
) {
  const startRad = (startAngle - 90) * Math.PI / 180;
  const endRad = (endAngle - 90) * Math.PI / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

function createRingSegmentPath(
  cx: number, cy: number,
  startAngle: number, endAngle: number,
  rOuter: number, rInner: number
) {
  const angleDiff = endAngle - startAngle;

  if (angleDiff >= 359.9) {
    return `M ${cx} ${cy - rOuter}
            A ${rOuter} ${rOuter} 0 1 1 ${cx} ${cy + rOuter}
            A ${rOuter} ${rOuter} 0 1 1 ${cx} ${cy - rOuter}
            M ${cx} ${cy - rInner}
            A ${rInner} ${rInner} 0 1 0 ${cx} ${cy + rInner}
            A ${rInner} ${rInner} 0 1 0 ${cx} ${cy - rInner} Z`;
  }

  const startRad = (startAngle - 90) * Math.PI / 180;
  const endRad = (endAngle - 90) * Math.PI / 180;
  const x1Outer = cx + rOuter * Math.cos(startRad);
  const y1Outer = cy + rOuter * Math.sin(startRad);
  const x2Outer = cx + rOuter * Math.cos(endRad);
  const y2Outer = cy + rOuter * Math.sin(endRad);
  const x1Inner = cx + rInner * Math.cos(startRad);
  const y1Inner = cy + rInner * Math.sin(startRad);
  const x2Inner = cx + rInner * Math.cos(endRad);
  const y2Inner = cy + rInner * Math.sin(endRad);
  const largeArc = angleDiff > 180 ? 1 : 0;
  return `M ${x1Outer} ${y1Outer} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2Outer} ${y2Outer} L ${x2Inner} ${y2Inner} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x1Inner} ${y1Inner} Z`;
}

function ColorChart({
  imageId, colors: rawColors, accentColors: rawAccentColors,
  isExpanded, hoveredColorIndex, onToggleExpand, onHoverColor,
}: Props) {
  const colors = rawColors.slice(0, 5);
  const accentColors = (rawAccentColors ?? []).filter(c => c && c.trim() !== '').slice(0, 3);
  const hasAccents = accentColors.length > 0;
  const segmentAngle = 360 / colors.length;

  const ringWidth = isExpanded ? 3.4 : 1.7;
  const gap = isExpanded ? 2 : 1;
  const baseSize = isExpanded ? 64 : 20;
  const size = hasAccents ? baseSize + (ringWidth + gap) * 2 : baseSize;
  const outerRadius = size / 2;
  const accentInnerRadius = hasAccents ? outerRadius - ringWidth : outerRadius;
  const innerRadius = hasAccents ? accentInnerRadius - gap : outerRadius;
  const cx = outerRadius;
  const cy = outerRadius;
  const accentSegmentAngle = accentColors.length > 0 ? 360 / accentColors.length : 360;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggleExpand();
        if (isExpanded) onHoverColor(null);
      }}
      className="absolute bottom-2 right-2 rounded-full z-10 transition-all duration-300 cursor-pointer"
      style={{
        width: size,
        height: size,
        boxShadow: isExpanded
          ? '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 3px rgba(255,255,255,0.3)'
          : '0 1px 3px rgba(0,0,0,0.3)'
      }}
      title={`\u041D\u0430\u0436\u043C\u0438\u0442\u0435 \u0447\u0442\u043E\u0431\u044B ${isExpanded ? '\u0441\u0432\u0435\u0440\u043D\u0443\u0442\u044C' : '\u0443\u0432\u0435\u043B\u0438\u0447\u0438\u0442\u044C'}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-full overflow-hidden">
        {isExpanded && (
          <defs>
            <linearGradient id={`gloss-${imageId}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
              <stop offset="40%" stopColor="rgba(255,255,255,0.1)" />
              <stop offset="60%" stopColor="rgba(0,0,0,0)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.15)" />
            </linearGradient>
            <clipPath id={`clip-inner-${imageId}`}>
              <circle cx={cx} cy={cy} r={innerRadius} />
            </clipPath>
          </defs>
        )}

        {/* Accent ring */}
        {hasAccents && accentColors.map((color, i) => (
          <path
            key={`accent-${i}`}
            d={createRingSegmentPath(cx, cy, i * accentSegmentAngle, (i + 1) * accentSegmentAngle, outerRadius - 0.5, accentInnerRadius)}
            fill={color}
          />
        ))}

        {/* Main colors */}
        {isExpanded ? (
          <g clipPath={`url(#clip-inner-${imageId})`}>
            {colors.map((color, i) => (
              <path
                key={i}
                d={createSegmentPath(cx, cy, i * segmentAngle, (i + 1) * segmentAngle, innerRadius)}
                fill={color}
                className="transition-opacity duration-150"
                style={{
                  opacity: hoveredColorIndex !== null && hoveredColorIndex !== i ? 0.4 : 1,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.stopPropagation(); onHoverColor(i); }}
                onMouseLeave={(e) => { e.stopPropagation(); onHoverColor(null); }}
              />
            ))}
            <circle cx={cx} cy={cy} r={innerRadius} fill={`url(#gloss-${imageId})`} pointerEvents="none" />
          </g>
        ) : (
          colors.map((color, i) => (
            <path
              key={i}
              d={createSegmentPath(cx, cy, i * segmentAngle, (i + 1) * segmentAngle, innerRadius)}
              fill={color}
            />
          ))
        )}

        {/* Inner stroke */}
        {hasAccents && (
          <circle cx={cx} cy={cy} r={innerRadius} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={0.5} />
        )}

        {/* Outer stroke */}
        <circle cx={cx} cy={cy} r={outerRadius - 0.5} fill="none" stroke={isExpanded ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.5)"} strokeWidth={1} />
      </svg>
    </button>
  );
}

export default memo(ColorChart);
