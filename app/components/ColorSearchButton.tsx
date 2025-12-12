"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ColorWheel } from "./ColorWheel";

const SLOT_SIZES = [32, 26, 22, 18, 14];
const EMPTY_COLOR = "#f3f4f6";

export default function ColorSearchButton() {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<string[]>(Array(5).fill(EMPTY_COLOR));
  const [selectedSlot, setSelectedSlot] = useState<number>(0);

  const router = useRouter();

  // Клик по цветовому кругу -> записать цвет в активный слот
  const handleWheelPick = (hex: string) => {
    setSlots((prev) => {
      const next = [...prev];
      next[selectedSlot] = hex;
      return next;
    });
  };

  // Быстрый запуск поиска: просто меняем URL и открываем вкладку "Картинки"
  const runSearch = () => {
    const colors = slots
      .filter((c) => c && c !== EMPTY_COLOR); // ВАЖНО: НЕ меняем регистр

    if (!colors.length) return;

    const params = new URLSearchParams();
    params.set("t", "images");                 // сразу на вкладку "Картинки"
    params.set("colors", colors.join(","));    // те же #HEX, что и в БД

    router.push(`/?${params.toString()}`);
    setOpen(false);
  };

  return (
    <div className="relative flex items-center">
      {/* Кнопка с маленьким 6-цветным мини-кругом */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-9 w-9 items-center justify-center rounded-full transition hover:scale-105"
        title="Быстрый поиск по цвету"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5">
          {["#FF0000", "#FFFF00", "#00FF00", "#00FFFF", "#0000FF", "#FF00FF"].map(
            (color, index) => {
              const angle = (index / 6) * Math.PI * 2;
              const radius = 7;
              const cx = 12 + radius * Math.cos(angle);
              const cy = 12 + radius * Math.sin(angle);
              return <circle key={index} cx={cx} cy={cy} r={2.3} fill={color} />;
            }
          )}
        </svg>
      </button>

      {/* Цветовой круг + слоты справа */}
      {open && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 flex items-center gap-3">
          <ColorWheel size={104} onClick={(c) => handleWheelPick(c.hex)} />

          <div className="flex flex-col items-center gap-2">
            {slots.map((color, index) => {
              const size = SLOT_SIZES[index];
              const isSelected = index === selectedSlot;
              const isEmpty = color === EMPTY_COLOR;

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedSlot(index)}
                  className={`rounded-full border-2 transition ${
                    isSelected ? "border-gray-900" : "border-transparent"
                  }`}
                  style={{
                    width: size,
                    height: size,
                    backgroundColor: isEmpty ? EMPTY_COLOR : color,
                  }}
                />
              );
            })}

            {/* кнопка Найти */}
            <button
              type="button"
              onClick={runSearch}
              className="mt-1 rounded-full bg-gray-900 px-4 py-1 text-xs font-medium text-white shadow-sm hover:bg-black transition"
            >
              Найти
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
