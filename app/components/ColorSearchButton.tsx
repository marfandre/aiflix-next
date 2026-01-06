"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import HorizontalHueSlider from "./HorizontalHueSlider";

const EMPTY_COLOR = "#f3f4f6";

export default function ColorSearchButton() {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<string[]>(Array(5).fill(EMPTY_COLOR));
  const [selectedSlot, setSelectedSlot] = useState<number>(0);

  const router = useRouter();

  // Клик по слайдеру -> записать цвет в активный слот
  const handleSliderChange = (hex: string) => {
    setSlots((prev) => {
      const next = [...prev];
      next[selectedSlot] = hex;
      return next;
    });
  };

  // Быстрый запуск поиска
  const runSearch = () => {
    const colors = slots.filter((c) => c && c !== EMPTY_COLOR);
    if (!colors.length) return;

    const params = new URLSearchParams();
    params.set("t", "images");
    params.set("colors", colors.join(","));

    router.push(`/?${params.toString()}`);
    setOpen(false);
  };

  return (
    <div className="relative flex items-center">
      {/* Кнопка — цветовой круг в стеклянной оправке */}
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          padding: 6,
          background: 'rgba(200,200,210,0.15)',
          boxShadow: `
            inset 0 0 0 1px rgba(255,255,255,0.35),
            0 0 0 1px rgba(255,255,255,0.2),
            0 2px 8px rgba(0,0,0,0.1)
          `,
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="relative h-6 w-6 flex-shrink-0 rounded-full transition hover:scale-105"
          style={{
            background: 'conic-gradient(from 180deg, #FF6B6B, #FFE066, #6BCB77, #4D96FF, #9B59B6, #FF6B6B)',
          }}
          title="Быстрый поиск по цвету"
        />
      </div>

      {/* Попап: Горизонтальное расположение */}
      {open && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 flex flex-col gap-2">
          {/* Кружочки в ряд сверху */}
          <div className="flex items-center gap-1.5">
            {slots.map((color, index) => {
              const size = 18;
              const isSelected = index === selectedSlot;
              const isEmpty = color === EMPTY_COLOR;

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedSlot(index)}
                  className="rounded-full transition"
                  style={{
                    width: size,
                    height: size,
                    backgroundColor: isEmpty ? EMPTY_COLOR : color,
                    border: isSelected ? '2px solid #1f2937' : '1px solid rgba(0,0,0,0.15)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  }}
                />
              );
            })}

            {/* кнопка Найти */}
            <button
              type="button"
              onClick={runSearch}
              className="ml-2 rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-black transition"
            >
              Найти
            </button>
          </div>

          {/* Горизонтальные слайдеры снизу */}
          <HorizontalHueSlider width={120} onChange={handleSliderChange} />
        </div>
      )}
    </div>
  );
}
