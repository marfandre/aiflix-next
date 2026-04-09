/**
 * Server-only: find positions on an image where each palette color is most dense.
 * Uses sharp (Node.js only) — do NOT import from client components.
 */

import sharp from 'sharp';

export type ColorPosition = { hex: string; x: number; y: number };

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    let h = hex.trim().toLowerCase();
    if (h.startsWith("#")) h = h.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return null;
    const num = Number.parseInt(h, 16);
    if (Number.isNaN(num)) return null;
    return { r: (num >> 16) & 0xff, g: (num >> 8) & 0xff, b: num & 0xff };
}

export async function findColorPositions(
    buffer: Buffer,
    colors: string[],
    options?: { gridSize?: number; threshold?: number; minDist?: number }
): Promise<ColorPosition[]> {
    const GRID = options?.gridSize ?? 10;
    const THRESHOLD = options?.threshold ?? 60;
    const MIN_DIST = options?.minDist ?? 0.08;

    try {
        const { data, info } = await sharp(buffer)
            .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const targetRgbs = colors.map(hex => hexToRgb(hex));
        const gridW = Math.ceil(info.width / GRID);
        const gridH = Math.ceil(info.height / GRID);

        const grids = targetRgbs.map(() =>
            Array.from({ length: gridH }, () => new Float64Array(gridW))
        );

        for (let y = 0; y < info.height; y++) {
            for (let x = 0; x < info.width; x++) {
                const i = (y * info.width + x) * info.channels;
                const r = data[i], g = data[i + 1], b = data[i + 2];

                let bestIdx = -1;
                let bestDist = Infinity;
                for (let ci = 0; ci < targetRgbs.length; ci++) {
                    const t = targetRgbs[ci];
                    if (!t) continue;
                    const dist = Math.sqrt((r - t.r) ** 2 + (g - t.g) ** 2 + (b - t.b) ** 2);
                    if (dist < bestDist) { bestDist = dist; bestIdx = ci; }
                }
                if (bestIdx >= 0 && bestDist < THRESHOLD) {
                    const gx = Math.min(Math.floor(x / GRID), gridW - 1);
                    const gy = Math.min(Math.floor(y / GRID), gridH - 1);
                    grids[bestIdx][gy][gx] += 1 / (1 + bestDist);
                }
            }
        }

        const cellsByColor: Array<Array<{ gx: number; gy: number; density: number }>> = grids.map(grid => {
            const cells: Array<{ gx: number; gy: number; density: number }> = [];
            for (let gy = 0; gy < gridH; gy++) {
                for (let gx = 0; gx < gridW; gx++) {
                    if (grid[gy][gx] > 0) {
                        cells.push({ gx, gy, density: grid[gy][gx] });
                    }
                }
            }
            cells.sort((a, b) => b.density - a.density);
            return cells;
        });

        const cellToPos = (gx: number, gy: number) => ({
            x: (gx + 0.5) * GRID / info.width,
            y: (gy + 0.5) * GRID / info.height,
        });

        const positions: ColorPosition[] = [];

        for (let ci = 0; ci < colors.length; ci++) {
            const cells = cellsByColor[ci];

            let placed = false;
            for (const cell of cells) {
                const pos = cellToPos(cell.gx, cell.gy);
                const tooClose = positions.some(p => {
                    const dx = p.x - pos.x;
                    const dy = p.y - pos.y;
                    return Math.sqrt(dx * dx + dy * dy) < MIN_DIST;
                });
                if (!tooClose) {
                    positions.push({ hex: colors[ci], ...pos });
                    placed = true;
                    break;
                }
            }

            if (!placed) {
                if (cells.length > 0) {
                    const pos = cellToPos(cells[0].gx, cells[0].gy);
                    positions.push({ hex: colors[ci], ...pos });
                } else {
                    positions.push({ hex: colors[ci], x: 0.2 + (ci * 0.15), y: 0.3 + (ci * 0.1) });
                }
            }
        }

        return positions;
    } catch (error) {
        console.error('findColorPositions error:', error);
        return colors.map((hex, i) => ({ hex, x: 0.2 + (i * 0.15), y: 0.3 + (i * 0.1) }));
    }
}
