"use client";

import React, { useState, useRef, useCallback } from "react";

type Props = {
    width?: number;
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

export default function HorizontalHueSlider({ width = 120, onChange }: Props) {
    const [hue, setHue] = useState(0);
    const [lightness, setLightness] = useState(50);
    const hueRef = useRef<HTMLDivElement>(null);
    const lightnessRef = useRef<HTMLDivElement>(null);

    const emitColor = useCallback((h: number, l: number) => {
        const hex = hslToHex(h, 100, l);
        onChange?.(hex);
    }, [onChange]);

    // Обработка Hue слайдера (горизонтальный)
    const updateHue = useCallback((e: React.MouseEvent | MouseEvent) => {
        if (!hueRef.current) return;
        const rect = hueRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const newHue = Math.round((x / rect.width) * 360);
        setHue(newHue);
        emitColor(newHue, lightness);
    }, [lightness, emitColor]);

    // Обработка Lightness слайдера (горизонтальный)
    const updateLightness = useCallback((e: React.MouseEvent | MouseEvent) => {
        if (!lightnessRef.current) return;
        const rect = lightnessRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        // Слева тёмный (0), справа светлый (100)
        const newLightness = Math.round((x / rect.width) * 100);
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
    const hueColor = hslToHex(hue, 100, 50);

    const stripHeight = 5;
    const thumbSize = 10;
    const sliderHeight = thumbSize + 2;

    // Позиции ползунков
    const hueThumbPos = (hue / 360) * width;
    const lightnessThumbPos = (lightness / 100) * width;

    return (
        <div className="flex flex-col gap-1">
            {/* Hue слайдер (цвета радуги) */}
            <div
                className="inline-flex items-center rounded-full bg-gray-100 shadow-sm"
                style={{ padding: 1 }}
            >
                <div
                    ref={hueRef}
                    className="relative cursor-pointer flex items-center justify-center"
                    style={{ width: width, height: sliderHeight }}
                    onMouseDown={createDragHandler(updateHue)}
                >
                    <div
                        className="rounded-full"
                        style={{
                            width: width,
                            height: stripHeight,
                            background: `linear-gradient(to right, 
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
                        className="absolute top-1/2 -translate-y-1/2 rounded-full border-2 border-white pointer-events-none"
                        style={{
                            width: thumbSize,
                            height: thumbSize,
                            left: hueThumbPos - thumbSize / 2,
                            backgroundColor: hueColor,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                        }}
                    />
                </div>
            </div>

            {/* Lightness слайдер (оттенки: тёмный → светлый) */}
            <div
                className="inline-flex items-center rounded-full bg-gray-100 shadow-sm"
                style={{ padding: 1 }}
            >
                <div
                    ref={lightnessRef}
                    className="relative cursor-pointer flex items-center justify-center"
                    style={{ width: width, height: sliderHeight }}
                    onMouseDown={createDragHandler(updateLightness)}
                >
                    <div
                        className="rounded-full"
                        style={{
                            width: width,
                            height: stripHeight,
                            background: `linear-gradient(to right, 
                                hsl(${hue}, 100%, 0%),
                                hsl(${hue}, 100%, 50%),
                                hsl(${hue}, 100%, 100%)
                            )`,
                        }}
                    />
                    <div
                        className="absolute top-1/2 -translate-y-1/2 rounded-full border-2 border-white pointer-events-none"
                        style={{
                            width: thumbSize,
                            height: thumbSize,
                            left: lightnessThumbPos - thumbSize / 2,
                            backgroundColor: currentColor,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
