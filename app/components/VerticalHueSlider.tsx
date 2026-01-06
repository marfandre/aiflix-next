"use client";

import React, { useState, useRef, useCallback } from "react";

type Props = {
    height?: number;
    onChange?: (hex: string) => void;
};

// Конвертация HSL в HEX
function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

export default function VerticalHueSlider({ height = 90, onChange }: Props) {
    const [hue, setHue] = useState(0);
    const [lightness, setLightness] = useState(50); // 0-100
    const hueRef = useRef<HTMLDivElement>(null);
    const lightnessRef = useRef<HTMLDivElement>(null);

    // Обновить цвет и вызвать onChange
    const emitColor = useCallback((h: number, l: number) => {
        const hex = hslToHex(h, 100, l);
        onChange?.(hex);
    }, [onChange]);

    // Обработка Hue слайдера
    const updateHue = useCallback((e: React.MouseEvent | MouseEvent) => {
        if (!hueRef.current) return;
        const rect = hueRef.current.getBoundingClientRect();
        const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
        const newHue = Math.round((y / rect.height) * 360);
        setHue(newHue);
        emitColor(newHue, lightness);
    }, [lightness, emitColor]);

    // Обработка Lightness слайдера
    const updateLightness = useCallback((e: React.MouseEvent | MouseEvent) => {
        if (!lightnessRef.current) return;
        const rect = lightnessRef.current.getBoundingClientRect();
        const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
        // Инвертируем: сверху светлый (100), снизу тёмный (0)
        const newLightness = Math.round(100 - (y / rect.height) * 100);
        setLightness(newLightness);
        emitColor(hue, newLightness);
    }, [hue, emitColor]);

    const createDragHandler = (updateFn: (e: MouseEvent) => void) => (e: React.MouseEvent) => {
        updateFn(e.nativeEvent);
        const handleMouseMove = (e: MouseEvent) => updateFn(e);
        const handleMouseUp = () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    };

    const currentColor = hslToHex(hue, 100, lightness);
    const hueColor = hslToHex(hue, 100, 50); // Чистый цвет для Hue слайдера

    const stripWidth = 4;
    const thumbSize = 10;
    const sliderWidth = thumbSize + 2;

    // Позиции ползунков
    const hueThumbPos = (hue / 360) * height;
    const lightnessThumbPos = ((100 - lightness) / 100) * height;

    return (
        <div className="flex items-center gap-1">
            {/* Lightness слайдер (оттенки: светлый → тёмный) */}
            <div
                className="inline-flex items-center rounded-full bg-gray-100 shadow-sm"
                style={{ padding: 1 }}
            >
                <div
                    ref={lightnessRef}
                    className="relative cursor-pointer flex items-center justify-center"
                    style={{ width: sliderWidth, height: height }}
                    onMouseDown={createDragHandler(updateLightness)}
                >
                    <div
                        className="rounded-full"
                        style={{
                            width: stripWidth,
                            height: height,
                            background: `linear-gradient(to bottom, 
                                hsl(${hue}, 100%, 100%),
                                hsl(${hue}, 100%, 50%),
                                hsl(${hue}, 100%, 0%)
                            )`,
                        }}
                    />
                    <div
                        className="absolute left-1/2 -translate-x-1/2 rounded-full border-2 border-white pointer-events-none"
                        style={{
                            width: thumbSize,
                            height: thumbSize,
                            top: lightnessThumbPos - thumbSize / 2,
                            backgroundColor: currentColor,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                        }}
                    />
                </div>
            </div>

            {/* Hue слайдер (цвета радуги) */}
            <div
                className="inline-flex items-center rounded-full bg-gray-100 shadow-sm"
                style={{ padding: 1 }}
            >
                <div
                    ref={hueRef}
                    className="relative cursor-pointer flex items-center justify-center"
                    style={{ width: sliderWidth, height: height }}
                    onMouseDown={createDragHandler(updateHue)}
                >
                    <div
                        className="rounded-full"
                        style={{
                            width: stripWidth,
                            height: height,
                            background: `linear-gradient(to bottom, 
                                hsl(0, 100%, 50%),
                                hsl(60, 100%, 50%),
                                hsl(120, 100%, 50%),
                                hsl(180, 100%, 50%),
                                hsl(240, 100%, 50%),
                                hsl(300, 100%, 50%),
                                hsl(360, 100%, 50%)
                            )`,
                        }}
                    />
                    <div
                        className="absolute left-1/2 -translate-x-1/2 rounded-full border-2 border-white pointer-events-none"
                        style={{
                            width: thumbSize,
                            height: thumbSize,
                            top: hueThumbPos - thumbSize / 2,
                            backgroundColor: hueColor,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
