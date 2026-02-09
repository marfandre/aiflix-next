'use client';

// app/components/ColorPickerOverlay.tsx
// Интерактивный компонент для выбора цветов на изображении
// Как в Adobe Color - маркеры можно перетаскивать

import { useEffect, useRef, useState, useCallback } from 'react';
import { getColorFromCanvas, isLightColor } from '@/app/utils/getColorAtPosition';

export interface ColorMarker {
    hex: string;
    x: number; // 0-1 относительные координаты
    y: number;
}

interface ColorPickerOverlayProps {
    imageUrl: string;
    colors: ColorMarker[];
    onColorsChange: (colors: ColorMarker[]) => void;
    onHoverChange?: (index: number | null) => void; // Индекс маркера под курсором
    maxColors?: number;
    maxHeight?: string;  // CSS max-height, например "60vh"
    className?: string;  // Дополнительные классы для контейнера
}

export default function ColorPickerOverlay({
    imageUrl,
    colors,
    onColorsChange,
    onHoverChange,
    maxColors = 5,
    maxHeight = '60vh',
    className = '',
}: ColorPickerOverlayProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

    // Загружаем изображение в canvas для получения цветов
    useEffect(() => {
        if (!imageUrl) return;

        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.drawImage(img, 0, 0);
            setImageLoaded(true);
        };

        img.src = imageUrl;
    }, [imageUrl]);

    // Получаем цвет при клике или перетаскивании
    const getColorAt = useCallback((clientX: number, clientY: number): ColorMarker | null => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas || !imageLoaded) return null;

        const rect = container.getBoundingClientRect();
        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top) / rect.height;

        // Ограничиваем координаты
        const clampedX = Math.max(0, Math.min(1, x));
        const clampedY = Math.max(0, Math.min(1, y));

        const hex = getColorFromCanvas(canvas, clampedX, clampedY);

        return { hex, x: clampedX, y: clampedY };
    }, [imageLoaded]);

    // Обработка начала перетаскивания
    const handleMarkerMouseDown = (e: React.MouseEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        setDraggingIndex(index);
    };

    // Обработка перетаскивания
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (draggingIndex === null) return;

        const newColor = getColorAt(e.clientX, e.clientY);
        if (!newColor) return;

        const newColors = [...colors];
        newColors[draggingIndex] = newColor;
        onColorsChange(newColors);
    }, [draggingIndex, colors, getColorAt, onColorsChange]);

    // Обработка окончания перетаскивания
    const handleMouseUp = useCallback(() => {
        setDraggingIndex(null);
    }, []);

    // Touch события
    const handleMarkerTouchStart = (e: React.TouchEvent, index: number) => {
        e.preventDefault();
        setDraggingIndex(index);
    };

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (draggingIndex === null) return;
        e.preventDefault();

        const touch = e.touches[0];
        const newColor = getColorAt(touch.clientX, touch.clientY);
        if (!newColor) return;

        const newColors = [...colors];
        newColors[draggingIndex] = newColor;
        onColorsChange(newColors);
    }, [draggingIndex, colors, getColorAt, onColorsChange]);

    const handleTouchEnd = useCallback(() => {
        setDraggingIndex(null);
    }, []);

    // Подписываемся на глобальные события мыши/тача
    useEffect(() => {
        if (draggingIndex !== null) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchmove', handleTouchMove, { passive: false });
            window.addEventListener('touchend', handleTouchEnd);

            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
                window.removeEventListener('touchmove', handleTouchMove);
                window.removeEventListener('touchend', handleTouchEnd);
            };
        }
    }, [draggingIndex, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

    // Клик по изображению - добавить новый маркер
    const handleContainerClick = (e: React.MouseEvent) => {
        if (colors.length >= maxColors) return;
        if (draggingIndex !== null) return;

        const newColor = getColorAt(e.clientX, e.clientY);
        if (!newColor) return;

        onColorsChange([...colors, newColor]);
    };

    // Удаление маркера по двойному клику
    const handleMarkerDoubleClick = (e: React.MouseEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        const newColors = colors.filter((_, i) => i !== index);
        onColorsChange(newColors);
    };

    return (
        <div
            ref={containerRef}
            className={`relative inline-block cursor-crosshair rounded-2xl overflow-hidden shadow-lg ${className}`}
            onClick={handleContainerClick}
            style={{ touchAction: 'none', maxHeight, maxWidth: '100%' }}
        >
            {/* Изображение — определяет размер контейнера */}
            <img
                src={imageUrl}
                alt="Color picker"
                className="block w-auto h-auto object-contain"
                style={{ maxHeight, maxWidth: '100%' }}
                draggable={false}
            />

            {/* Скрытый canvas для получения цветов */}
            <canvas
                ref={canvasRef}
                className="hidden"
            />

            {/* Маркеры цветов — minimal pin style */}
            {imageLoaded && colors.map((color, index) => {
                const isDragging = draggingIndex === index;

                return (
                    <div
                        key={index}
                        className={`absolute transform -translate-x-1/2 -translate-y-1/2
                            transition-transform duration-100 ease-out
                            ${isDragging ? 'scale-110 z-20' : 'z-10 hover:scale-105'}
                        `}
                        style={{
                            left: `${color.x * 100}%`,
                            top: `${color.y * 100}%`,
                        }}
                        onMouseDown={(e) => handleMarkerMouseDown(e, index)}
                        onTouchStart={(e) => handleMarkerTouchStart(e, index)}
                        onDoubleClick={(e) => handleMarkerDoubleClick(e, index)}
                        onMouseEnter={() => onHoverChange?.(index)}
                        onMouseLeave={() => onHoverChange?.(null)}
                    >
                        {/* Кружок с цветом */}
                        <div
                            className={`w-6 h-6 rounded-full border-[1.5px] border-white cursor-grab
                                ${isDragging ? 'cursor-grabbing' : ''}`}
                            style={{
                                backgroundColor: color.hex,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                            }}
                        />

                        {/* Tooltip с hex при перетаскивании */}
                        {isDragging && (
                            <div
                                className="absolute left-1/2 -translate-x-1/2 -top-7
                                    px-2 py-0.5 rounded text-xs font-mono whitespace-nowrap
                                    bg-black/80 text-white shadow-lg"
                            >
                                {color.hex}
                            </div>
                        )}
                    </div>
                );
            })}

        </div>
    );
}
