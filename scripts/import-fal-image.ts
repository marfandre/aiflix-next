// scripts/import-fal-image.ts
// Импорт одной картинки из fal.ai на платформу
// Использование: npx tsx scripts/import-fal-image.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FAL_KEY = process.env.FAL_KEY!;
const IMPORT_USER_ID = process.env.IMPORT_USER_ID!;

// --- HSL-based color family mapping (same as palette/route.ts) ---
function hexToFamily(hex: string): string {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return 'black';
    let r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2 * 100;
    let s = 0, h = 0;
    if (max !== min) {
        const d = max - min;
        s = (l > 50 ? d / (2 - max - min) : d / (max + min)) * 100;
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6 * 360;
        else if (max === g) h = ((b - r) / d + 2) / 6 * 360;
        else h = ((r - g) / d + 4) / 6 * 360;
    }
    if (s < 15) { if (l < 15) return 'black'; if (l > 70) return 'white'; return 'brown'; }
    if (s < 30) { if (l < 15) return 'black'; if (l < 50) return 'brown'; return 'pink'; }
    if (l < 8) return 'black';
    if (l > 95) return 'white';
    if (h >= 10 && h < 40 && l < 45 && s < 80) return 'brown';
    if (h < 15) return l > 70 ? 'pink' : 'red';
    if (h < 40) return 'orange';
    if (h < 65) return 'yellow';
    if (h < 160) return 'green';
    if (h < 185) return 'teal';
    if (h < 210) return 'cyan';
    if (h < 260) return 'blue';
    if (h < 290) return 'indigo';
    if (h < 330) return s > 40 && l > 40 ? 'pink' : 'purple';
    if (h < 346) return 'pink';
    return l > 70 || (l > 50 && s < 60) ? 'pink' : 'red';
}

// --- Bucket mapping (same as images/complete) ---
const BUCKET_BASE_COLORS = [
    { id: "red", r: 255, g: 23, b: 68 },
    { id: "orange", r: 255, g: 109, b: 0 },
    { id: "yellow", r: 255, g: 234, b: 0 },
    { id: "green", r: 0, g: 230, b: 118 },
    { id: "teal", r: 29, g: 233, b: 182 },
    { id: "cyan", r: 0, g: 229, b: 255 },
    { id: "blue", r: 41, g: 121, b: 255 },
    { id: "indigo", r: 101, g: 31, b: 255 },
    { id: "purple", r: 213, g: 0, b: 249 },
    { id: "pink", r: 255, g: 64, b: 129 },
    { id: "brown", r: 141, g: 110, b: 99 },
    { id: "black", r: 18, g: 18, b: 18 },
    { id: "white", r: 250, g: 250, b: 250 },
];

function mapHexToBucket(hex: string): string | null {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return null;
    const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    let bestId: string | null = null;
    let bestDist = Infinity;
    for (const c of BUCKET_BASE_COLORS) {
        const dist = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2;
        if (dist < bestDist) { bestDist = dist; bestId = c.id; }
    }
    return bestId;
}

// --- Color extraction using sharp + quantize ---
type RGB = [number, number, number];

function rgbToHex([r, g, b]: RGB): string {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`.toUpperCase();
}

async function extractColors(imageBuffer: Buffer, count: number = 5): Promise<string[]> {
    const quantizeMod = await import('quantize');
    const quantize = (quantizeMod.default || quantizeMod) as any;

    const { data: pixelData, info } = await sharp(imageBuffer)
        .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const pixels: RGB[] = [];
    const totalPixels = info.width * info.height;
    for (let i = 0; i < totalPixels; i += 3) {
        const idx = i * info.channels;
        pixels.push([pixelData[idx], pixelData[idx + 1], pixelData[idx + 2]]);
    }

    if (pixels.length === 0) return [];

    const result = quantize(pixels, count * 2);
    if (!result) return [];

    const palette = (result.palette() as RGB[]).slice(0, count);
    return palette.map(rgbToHex);
}

// --- Find color positions on image (peak density grid) ---
type ColorPosition = { hex: string; x: number; y: number };

function hexToRgbObj(hex: string): { r: number; g: number; b: number } | null {
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return null;
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

async function findColorPositions(buffer: Buffer, colors: string[]): Promise<ColorPosition[]> {
    try {
        const { data, info } = await sharp(buffer)
            .resize(200, 200, { fit: 'inside' })
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const targetRgbs = colors.map(hex => hexToRgbObj(hex));
        const THRESHOLD = 60;
        const GRID = 10;
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

        const positions: ColorPosition[] = [];
        for (let ci = 0; ci < colors.length; ci++) {
            let maxDensity = 0, peakGx = 0, peakGy = 0;
            for (let gy = 0; gy < gridH; gy++) {
                for (let gx = 0; gx < gridW; gx++) {
                    if (grids[ci][gy][gx] > maxDensity) {
                        maxDensity = grids[ci][gy][gx]; peakGx = gx; peakGy = gy;
                    }
                }
            }
            if (maxDensity > 0) {
                positions.push({
                    hex: colors[ci],
                    x: (peakGx + 0.5) * GRID / info.width,
                    y: (peakGy + 0.5) * GRID / info.height,
                });
            } else {
                let bestDist = Infinity, bestX = 0.5, bestY = 0.5;
                const t = targetRgbs[ci];
                if (t) {
                    for (let y = 0; y < info.height; y += 2) {
                        for (let x = 0; x < info.width; x += 2) {
                            const idx = (y * info.width + x) * info.channels;
                            const dist = Math.sqrt((data[idx] - t.r) ** 2 + (data[idx + 1] - t.g) ** 2 + (data[idx + 2] - t.b) ** 2);
                            if (dist < bestDist) { bestDist = dist; bestX = x / info.width; bestY = y / info.height; }
                        }
                    }
                }
                positions.push({ hex: colors[ci], x: bestX, y: bestY });
            }
        }

        // Разводим слишком близкие маркеры
        const MIN_DIST = 0.08;
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const dx = positions[j].x - positions[i].x;
                const dy = positions[j].y - positions[i].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < MIN_DIST && dist > 0) {
                    const scale = (MIN_DIST - dist) / 2 / dist;
                    positions[i].x = Math.max(0.02, Math.min(0.98, positions[i].x - dx * scale));
                    positions[i].y = Math.max(0.02, Math.min(0.98, positions[i].y - dy * scale));
                    positions[j].x = Math.max(0.02, Math.min(0.98, positions[j].x + dx * scale));
                    positions[j].y = Math.max(0.02, Math.min(0.98, positions[j].y + dy * scale));
                }
            }
        }

        return positions;
    } catch (error) {
        console.error('findColorPositions error:', error);
        return colors.map((hex, i) => ({ hex, x: 0.2 + (i * 0.15), y: 0.3 + (i * 0.1) }));
    }
}

// --- Aspect ratio ---
function getAspectRatioString(w: number, h: number): string {
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const d = gcd(w, h);
    return `${w / d}:${h / d}`;
}

// --- Main ---
async function importFalImage(requestId?: string) {
    console.log('=== Importing image from fal.ai ===\n');

    // 1. Fetch generation history
    const historyRes = await fetch(
        `https://rest.alpha.fal.ai/requests/?start_time=2025-01-01T00:00:00Z&end_time=2027-01-01T00:00:00Z`,
        { headers: { 'Authorization': `Key ${FAL_KEY}` }, redirect: 'follow' }
    );
    const history = await historyRes.json();
    const items = history.items ?? [];

    // Find the target request (or use the specific one)
    let target: any;
    if (requestId) {
        target = items.find((i: any) => i.request_id.startsWith(requestId));
    } else {
        // Default: the fashion portrait with goggles (#10)
        target = items.find((i: any) =>
            i.json_input?.prompt?.includes('fashion portrait, centered bust shot of a futuristic model')
        );
    }

    if (!target) {
        console.error('Target generation not found!');
        return;
    }

    const imageUrl = target.json_output?.images?.[0]?.url;
    const imageWidth = target.json_output?.images?.[0]?.width;
    const imageHeight = target.json_output?.images?.[0]?.height;
    const prompt = target.json_input?.prompt ?? null;
    const seed = target.json_output?.seed?.toString() ?? null;
    const endpoint = target.endpoint ?? 'flux';
    const model = endpoint.replace('fal-ai/', '');

    console.log(`Model: ${model}`);
    console.log(`Prompt: ${prompt?.substring(0, 80)}...`);
    console.log(`Image: ${imageUrl}`);
    console.log(`Size: ${imageWidth}x${imageHeight}`);
    console.log(`Seed: ${seed}`);

    // 2. Download image
    console.log('\nDownloading image...');
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
        console.error('Failed to download image:', imgRes.status);
        return;
    }
    const imageBuffer = Buffer.from(await imgRes.arrayBuffer());
    console.log(`Downloaded: ${(imageBuffer.length / 1024).toFixed(1)} KB`);

    // 3. Extract colors
    console.log('\nExtracting colors...');
    const colors = await extractColors(imageBuffer, 5);
    console.log(`Colors: ${colors.join(', ')}`);

    // 4. Get NTC names
    let colorNames: string[] = [];
    try {
        const namer = (await import('color-namer')).default;
        colorNames = colors.map((hex) => {
            try { return namer(hex).ntc[0]?.name ?? ''; } catch { return ''; }
        }).filter(Boolean);
    } catch { }
    console.log(`Names: ${colorNames.join(', ')}`);

    // 5. Get families
    const colorFamilies = colors.map(hexToFamily);
    console.log(`Families: ${colorFamilies.join(', ')}`);

    // 5.5. Find color positions on image
    console.log('\nFinding color positions...');
    const colorPositions = await findColorPositions(imageBuffer, colors);
    console.log(`Positions: ${colorPositions.map(p => `${p.hex}(${p.x.toFixed(2)},${p.y.toFixed(2)})`).join(', ')}`);

    // 6. Upload to Supabase Storage
    const fileName = `fal_${Date.now()}_${target.request_id.substring(0, 8)}.jpg`;
    const storagePath = `uploads/${fileName}`;
    console.log(`\nUploading to storage: ${storagePath}`);

    const { error: uploadError } = await supabase
        .storage
        .from('images')
        .upload(storagePath, imageBuffer, {
            contentType: 'image/jpeg',
            upsert: false,
        });

    if (uploadError) {
        console.error('Storage upload error:', uploadError);
        return;
    }
    console.log('Uploaded to storage!');

    // 7. Calculate aspect ratio
    const aspectRatio = imageWidth && imageHeight
        ? getAspectRatioString(imageWidth, imageHeight)
        : null;

    // 8. Insert into images_meta
    const row = {
        user_id: IMPORT_USER_ID,
        path: storagePath,
        title: null,
        description: null,
        prompt,
        colors: colors.length ? colors.map(c => c.toLowerCase()) : null,
        color_weights: null,
        color_names: colorNames.length ? colorNames : null,
        color_families: colorFamilies.length ? colorFamilies : null,
        accent_colors: null,
        color_positions: colorPositions.length ? colorPositions : null,
        dominant_color: mapHexToBucket(colors[0]) ?? null,
        secondary_color: mapHexToBucket(colors[1]) ?? null,
        third_color: mapHexToBucket(colors[2]) ?? null,
        fourth_color: mapHexToBucket(colors[3]) ?? null,
        fifth_color: mapHexToBucket(colors[4]) ?? null,
        aspect_ratio: aspectRatio,
        model,
        seed,
        source: 'fal',
        source_author: null,
        source_url: imageUrl,
        tags: [],
    };

    const { data, error: insertError } = await supabase
        .from('images_meta')
        .insert(row)
        .select('id');

    if (insertError) {
        console.error('Insert error:', insertError);
        return;
    }

    console.log(`\n✅ Imported! Image ID: ${data?.[0]?.id}`);
    console.log(`   Path: ${storagePath}`);
    console.log(`   Colors: ${colors.join(', ')}`);
    console.log(`   Families: ${colorFamilies.join(', ')}`);
    console.log(`   Model: ${model}`);
    console.log(`   Aspect: ${aspectRatio}`);
}

// Run
const targetRequestId = process.argv[2]; // optional: pass request_id as argument
importFalImage(targetRequestId);
