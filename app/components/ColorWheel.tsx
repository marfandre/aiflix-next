"use client";

import React, { useEffect, useRef } from "react";

export type ColorWheelColor = { hex: string };

interface ColorWheelProps {
  size?: number;
  strokeWidth?: number; // для совместимости, просто игнорируем
  onClick?: (color: ColorWheelColor) => void;
}

// hsl -> rgb (точно как в SearchButton)
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = h * 6;
  const x = c * (1 - Math.abs((hh % 2) - 1));

  let r1 = 0,
    g1 = 0,
    b1 = 0;

  if (hh >= 0 && hh < 1) {
    r1 = c;
    g1 = x;
  } else if (hh < 2) {
    r1 = x;
    g1 = c;
  } else if (hh < 3) {
    g1 = c;
    b1 = x;
  } else if (hh < 4) {
    g1 = x;
    b1 = c;
  } else if (hh < 5) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  const m = l - c / 2;

  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ];
}

export function ColorWheel({ size = 180, strokeWidth, onClick }: ColorWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Рисуем круг — тот же алгоритм, что в основной модалке
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = size;
    const h = size;
    canvas.width = w;
    canvas.height = h;

    const imageData = ctx.createImageData(w, h);
    const data = imageData.data;

    const cx = w / 2;
    const cy = h / 2;
    const outerR = Math.min(cx, cy) - 1;
    const innerR = outerR * 0.28;

    const SECTORS = 24;
    const RINGS = 5;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * w + x) * 4;

        // снаружи круга — прозрачность
        if (r > outerR) {
          data[idx + 3] = 0;
          continue;
        }

        // внутри центрального «отверстия» — светло-серый
        if (r < innerR) {
          data[idx] = 245;
          data[idx + 1] = 245;
          data[idx + 2] = 245;
          data[idx + 3] = 255;
          continue;
        }

        const ringNorm = (r - innerR) / (outerR - innerR);
        const ringIdx = Math.min(
          RINGS - 1,
          Math.max(0, Math.floor(ringNorm * RINGS)),
        );

        const angle = Math.atan2(dy, dx);
        let hueDeg = (angle * 180) / Math.PI;
        if (hueDeg < 0) hueDeg += 360;

        const sectorIdx = Math.floor((hueDeg / 360) * SECTORS);
        const sectorCenterDeg = ((sectorIdx + 0.5) / SECTORS) * 360;

        const ringCenter = (ringIdx + 0.5) / RINGS;
        const saturation = 0.35 + 0.65 * ringCenter;
        const lightness = 0.6 - 0.18 * ringCenter;

        const [R, G, B] = hslToRgb(
          sectorCenterDeg / 360,
          saturation,
          lightness,
        );

        data[idx] = R;
        data[idx + 1] = G;
        data[idx + 2] = B;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // белые разделительные линии, как в модалке
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1;

    for (let i = 0; i < SECTORS; i++) {
      const a = (i / SECTORS) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(innerR * Math.cos(a), innerR * Math.sin(a));
      ctx.lineTo(outerR * Math.cos(a), outerR * Math.sin(a));
      ctx.stroke();
    }

    for (let j = 1; j < RINGS; j++) {
      const r = innerR + ((outerR - innerR) * j) / RINGS;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(0, 0, outerR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, innerR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }, [size]);

  // Берём цвет пикселя по клику — ровно как в SearchButton
  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    // если попали в пустую область — выходим
    if (pixel[3] === 0) return;

    const hex =
      "#" +
      [0, 1, 2]
        .map((i) => pixel[i].toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();

    onClick?.({ hex });
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{
        cursor: "crosshair",
        borderRadius: "999px",
        display: "block",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.06)",
      }}
      width={size}
      height={size}
    />
  );
}
