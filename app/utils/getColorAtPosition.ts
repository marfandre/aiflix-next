// app/utils/getColorAtPosition.ts
// Утилита для получения цвета пикселя из изображения по координатам

/**
 * Загружает изображение и возвращает цвет пикселя по относительным координатам
 * @param imageUrl - URL изображения
 * @param x - относительная X координата (0-1)
 * @param y - относительная Y координата (0-1)
 * @returns hex цвет
 */
export async function getColorAtPosition(
    imageUrl: string,
    x: number,
    y: number
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Cannot get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0);

            // Конвертируем относительные координаты в абсолютные
            const pixelX = Math.floor(x * img.naturalWidth);
            const pixelY = Math.floor(y * img.naturalHeight);

            // Получаем цвет пикселя
            const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;
            const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);

            resolve(hex);
        };

        img.onerror = () => {
            reject(new Error('Failed to load image'));
        };

        img.src = imageUrl;
    });
}

/**
 * Получает цвет из загруженного canvas элемента
 * @param canvas - canvas с изображением
 * @param x - относительная X координата (0-1)
 * @param y - относительная Y координата (0-1)
 * @returns hex цвет
 */
export function getColorFromCanvas(
    canvas: HTMLCanvasElement,
    x: number,
    y: number
): string {
    const ctx = canvas.getContext('2d');
    if (!ctx) return '#000000';

    const pixelX = Math.floor(x * canvas.width);
    const pixelY = Math.floor(y * canvas.height);

    const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;
    return rgbToHex(pixel[0], pixel[1], pixel[2]);
}

/**
 * Конвертирует RGB в HEX
 */
function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Определяет, светлый ли цвет (для контрастного текста)
 */
export function isLightColor(hex: string): boolean {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
}
