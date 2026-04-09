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

import { hexToFamily } from '../lib/color-utils';
import { findColorPositions } from '../lib/color-positions';

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
