// scripts/generate-batch-5.ts
// Generate 5 pink hero images via fal.ai and upload to platform
// Usage: npx tsx scripts/generate-batch-5.ts

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

// ─── PROMPTS ──────────────────────────────────────────────────────────
const ITEMS = [
    {
        title: 'Halo Portrait',
        prompt: 'Close portrait of a young woman against a smooth pastel pink wall, a perfect pale pink halo circle behind her head, soft skin detail, luxury beauty editorial',
        model: 'fal-ai/flux/dev',
        modelName: 'flux/dev',
        size: 'portrait_4_3',
        tags: ['portrait', 'halo', 'beauty'],
    },
    {
        title: 'Mirror Selfie Gallery',
        prompt: 'A stylish young woman taking a mirror selfie in a quiet pink marble gallery, classic pink rose reflections, minimal fashion editorial, clean hero composition',
        model: 'fal-ai/flux-pro/v1.1',
        modelName: 'flux-pro',
        size: 'portrait_4_3',
        tags: ['mirror', 'selfie', 'gallery'],
    },
    {
        title: 'Veil Portrait',
        prompt: 'Close portrait of a woman under a translucent blush veil, authentic pink shadows across her face, soft studio light, premium beauty campaign',
        model: 'fal-ai/flux/dev',
        modelName: 'flux/dev',
        size: 'portrait_4_3',
        tags: ['veil', 'portrait', 'beauty'],
    },
    {
        title: 'Rose Chrome Jacket',
        prompt: 'A woman in a glossy pink chrome jacket standing against a pale pink backdrop, hibiscus highlights on the folds, direct fashion portrait, sharp focus',
        model: 'fal-ai/flux-pro/v1.1',
        modelName: 'flux-pro',
        size: 'portrait_4_3',
        tags: ['chrome', 'jacket', 'fashion'],
    },
    {
        title: 'Powder Wind',
        prompt: 'A female fashion portrait with a ribbon of soft pink powder crossing the frame behind her, pastel skin tones, minimal set, cinematic beauty image',
        model: 'fal-ai/flux/dev',
        modelName: 'flux/dev',
        size: 'portrait_4_3',
        tags: ['powder', 'fashion', 'cinematic'],
    },
];

// ─── Helpers (same as generate-one.ts) ────────────────────────────────
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
        .removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels: RGB[] = [];
    const totalPixels = info.width * info.height;
    for (let i = 0; i < totalPixels; i += 3) {
        const idx = i * info.channels;
        pixels.push([pixelData[idx], pixelData[idx + 1], pixelData[idx + 2]]);
    }
    if (pixels.length === 0) return [];
    const result = quantize(pixels, count * 2);
    if (!result) return [];
    return (result.palette() as RGB[]).slice(0, count).map(rgbToHex);
}

function getAspectRatioString(w: number, h: number): string {
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const d = gcd(w, h);
    return `${w / d}:${h / d}`;
}

async function generateImage(prompt: string, endpoint: string, imageSize: string) {
    const body: any = { prompt, num_images: 1, image_size: imageSize, enable_safety_checker: false };
    const res = await fetch(`https://fal.run/${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) { console.error(`   fal.ai error ${res.status}:`, await res.text().catch(() => '')); return null; }
    const data = await res.json();
    const img = data.images?.[0];
    if (!img?.url) { console.error('   No image in response'); return null; }
    return { url: img.url, width: img.width, height: img.height, seed: data.seed?.toString() ?? null };
}

// ─── Main ─────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n=== Batch Generate: ${ITEMS.length} images ===\n`);
    let success = 0, failed = 0;

    for (let i = 0; i < ITEMS.length; i++) {
        const item = ITEMS[i];
        console.log(`\n[${i + 1}/${ITEMS.length}] "${item.title}"`);
        console.log(`   Model: ${item.modelName}, Size: ${item.size}`);

        try {
            // 1. Generate
            const result = await generateImage(item.prompt, item.model, item.size);
            if (!result) { failed++; continue; }
            console.log(`   Generated: ${result.width}x${result.height}, seed=${result.seed}`);

            // 2. Download (3 retries)
            let imageBuffer: Buffer | null = null;
            for (let dl = 0; dl < 3; dl++) {
                try {
                    const imgRes = await fetch(result.url);
                    if (!imgRes.ok) { await new Promise(r => setTimeout(r, 2000)); continue; }
                    imageBuffer = Buffer.from(await imgRes.arrayBuffer());
                    break;
                } catch (e: any) { await new Promise(r => setTimeout(r, 3000)); }
            }
            if (!imageBuffer) { console.error('   FAILED to download'); failed++; continue; }
            console.log(`   Downloaded: ${(imageBuffer.length / 1024).toFixed(0)} KB`);

            // 3. Colors
            const colors = await extractColors(imageBuffer, 5);
            let colorNames: string[] = [];
            try {
                const namer = (await import('color-namer')).default;
                colorNames = colors.map(hex => { try { return namer(hex).ntc[0]?.name ?? ''; } catch { return ''; } }).filter(Boolean);
            } catch { }
            const colorFamilies = colors.map(hexToFamily);
            const colorPositions = await findColorPositions(imageBuffer, colors);

            // 4. Upload
            const safeTitle = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
            const fileName = `gen_${safeTitle}_${Date.now()}.jpg`;
            const storagePath = `uploads/${fileName}`;
            const { error: uploadError } = await supabase.storage.from('images')
                .upload(storagePath, imageBuffer, { contentType: 'image/jpeg', upsert: false });
            if (uploadError) { console.error('   Upload error:', uploadError.message); failed++; continue; }

            // 5. Aspect ratio
            let imgW = result.width, imgH = result.height;
            if (!imgW || !imgH) { const m = await sharp(imageBuffer).metadata(); imgW = m.width ?? 0; imgH = m.height ?? 0; }
            const aspectRatio = imgW && imgH ? getAspectRatioString(imgW, imgH) : null;

            // 6. Insert DB
            const row = {
                user_id: IMPORT_USER_ID, path: storagePath, title: item.title,
                description: null, prompt: item.prompt,
                colors: colors.length ? colors.map(c => c.toLowerCase()) : null,
                color_weights: null, color_names: colorNames.length ? colorNames : null,
                color_families: colorFamilies.length ? colorFamilies : null,
                accent_colors: null, color_positions: colorPositions.length ? colorPositions : null,
                dominant_color: mapHexToBucket(colors[0]) ?? null,
                secondary_color: mapHexToBucket(colors[1]) ?? null,
                third_color: mapHexToBucket(colors[2]) ?? null,
                fourth_color: mapHexToBucket(colors[3]) ?? null,
                fifth_color: mapHexToBucket(colors[4]) ?? null,
                aspect_ratio: aspectRatio, model: item.modelName, seed: result.seed,
                source: null, source_author: null, source_url: result.url,
                tags: item.tags,
            };
            const { data, error: insertError } = await supabase.from('images_meta').insert(row).select('id');
            if (insertError) { console.error('   DB error:', insertError.message); failed++; continue; }

            console.log(`   ✅ ID: ${data?.[0]?.id} | ${aspectRatio} | ${colors.join(', ')}`);
            success++;
        } catch (err: any) {
            console.error(`   ERROR: ${err.message}`);
            failed++;
        }
    }

    console.log(`\n=== Done! Success: ${success}, Failed: ${failed} ===\n`);
}

main().catch(console.error);
