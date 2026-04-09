// scripts/generate-one.ts
// Generate a single image via fal.ai and upload to platform
// Usage: npx tsx scripts/generate-one.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { hexToFamily } from '../lib/color-utils';
import { findColorPositions } from '../lib/color-positions';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FAL_KEY = process.env.FAL_KEY!;
const IMPORT_USER_ID = process.env.IMPORT_USER_ID!;

// ─── CONFIG: Edit these for each generation ───────────────────────────
const TITLE = 'Cotton Candy Avalanche';
const PROMPT = 'A woman in a crisp white tailored suit walking calmly through a hallway as an enormous wave of cotton candy in #FBCCE7 crashes through the windows behind her, sugar strands in #F4A6B6 flying past her shoulders, motion blur on the candy but tack-sharp on her face, surreal fashion campaign, cinematic lighting, 8k';
const MODEL_ENDPOINT = 'fal-ai/flux/dev';
const MODEL_NAME = 'flux/dev';
const IMAGE_SIZE = 'portrait_4_3'; // square_hd | landscape_4_3 | portrait_4_3 | portrait_16_9
// ──────────────────────────────────────────────────────────────────────

// --- Bucket mapping ---
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

// --- Color extraction ---
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

// --- Generate via fal.ai ---
async function generateImage(prompt: string, endpoint: string, imageSize: string) {
    console.log(`Calling ${endpoint} with size=${imageSize}...`);

    const body: any = {
        prompt,
        num_images: 1,
        image_size: imageSize,
        enable_safety_checker: false,
    };

    const res = await fetch(`https://fal.run/${endpoint}`, {
        method: 'POST',
        headers: {
            'Authorization': `Key ${FAL_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        console.error(`fal.ai error ${res.status}:`, await res.text().catch(() => ''));
        return null;
    }

    const data = await res.json();

    if (data.request_id && !data.images) {
        return await pollForResult(data.status_url, data.response_url);
    }

    const img = data.images?.[0];
    if (!img?.url) { console.error('No image in response'); return null; }

    return { url: img.url, width: img.width, height: img.height, seed: data.seed?.toString() ?? null };
}

async function pollForResult(statusUrl: string, responseUrl: string) {
    console.log('Queued, polling...');
    for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise(r => setTimeout(r, 5000));
        const statusRes = await fetch(statusUrl, { headers: { 'Authorization': `Key ${FAL_KEY}` } });
        let status: any;
        try { status = await statusRes.json(); } catch { continue; }

        if (status.status === 'COMPLETED') {
            const resultRes = await fetch(responseUrl, { headers: { 'Authorization': `Key ${FAL_KEY}` } });
            const data = await resultRes.json();
            const img = data.images?.[0];
            if (!img?.url) return null;
            return { url: img.url, width: img.width, height: img.height, seed: data.seed?.toString() ?? null };
        }
        if (status.status === 'FAILED') { console.error(`Failed: ${status.error}`); return null; }
        process.stdout.write('.');
    }
    console.error('Timeout'); return null;
}

// --- Main ---
async function main() {
    console.log(`\n=== Generating: "${TITLE}" ===`);
    console.log(`Model: ${MODEL_NAME}, Size: ${IMAGE_SIZE}`);
    console.log(`Prompt: ${PROMPT}\n`);

    // 1. Generate
    const result = await generateImage(PROMPT, MODEL_ENDPOINT, IMAGE_SIZE);
    if (!result) { console.error('FAILED to generate'); return; }
    console.log(`\nGenerated: ${result.width}x${result.height}, seed=${result.seed}`);

    // 2. Download (3 retries)
    let imageBuffer: Buffer | null = null;
    for (let dl = 0; dl < 3; dl++) {
        try {
            const imgRes = await fetch(result.url);
            if (!imgRes.ok) { console.error(`Download attempt ${dl + 1}: ${imgRes.status}`); await new Promise(r => setTimeout(r, 2000)); continue; }
            imageBuffer = Buffer.from(await imgRes.arrayBuffer());
            break;
        } catch (e: any) { console.error(`Download attempt ${dl + 1}: ${e.message}`); await new Promise(r => setTimeout(r, 3000)); }
    }
    if (!imageBuffer) { console.error('FAILED to download'); return; }
    console.log(`Downloaded: ${(imageBuffer.length / 1024).toFixed(0)} KB`);

    // 3. Colors
    const colors = await extractColors(imageBuffer, 5);
    console.log(`Colors: ${colors.join(', ')}`);

    // 4. Color names
    let colorNames: string[] = [];
    try {
        const namer = (await import('color-namer')).default;
        colorNames = colors.map(hex => { try { return namer(hex).ntc[0]?.name ?? ''; } catch { return ''; } }).filter(Boolean);
    } catch { }

    // 5. Families
    const colorFamilies = colors.map(hexToFamily);
    console.log(`Families: ${colorFamilies.join(', ')}`);

    // 6. Positions
    const colorPositions = await findColorPositions(imageBuffer, colors);

    // 7. Upload to storage
    const safeTitle = TITLE.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
    const fileName = `gen_${safeTitle}_${Date.now()}.jpg`;
    const storagePath = `uploads/${fileName}`;

    const { error: uploadError } = await supabase
        .storage.from('images')
        .upload(storagePath, imageBuffer, { contentType: 'image/jpeg', upsert: false });

    if (uploadError) { console.error('Upload error:', uploadError.message); return; }

    // 8. Aspect ratio
    let imgW = result.width, imgH = result.height;
    if (!imgW || !imgH) { const m = await sharp(imageBuffer).metadata(); imgW = m.width ?? 0; imgH = m.height ?? 0; }
    const aspectRatio = imgW && imgH ? getAspectRatioString(imgW, imgH) : null;

    // 9. Insert into DB
    const row = {
        user_id: IMPORT_USER_ID,
        path: storagePath,
        title: TITLE,
        description: null,
        prompt: PROMPT,
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
        model: MODEL_NAME,
        seed: result.seed,
        source: null,
        source_author: null,
        source_url: result.url,
        tags: ['mirror', 'monolith', 'selfie'],
    };

    const { data, error: insertError } = await supabase.from('images_meta').insert(row).select('id');
    if (insertError) { console.error('DB error:', insertError.message); return; }

    console.log(`\n✅ Done! ID: ${data?.[0]?.id}`);
    console.log(`   Path: ${storagePath}`);
    console.log(`   Colors: ${colors.join(', ')}`);
    console.log(`   Aspect: ${aspectRatio}`);
    console.log(`   Model: ${MODEL_NAME}`);
}

main().catch(console.error);
