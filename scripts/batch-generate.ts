// scripts/batch-generate.ts
// Batch generation: read prompt pairs -> generate via fal.ai -> upload to platform
// Usage: npx tsx scripts/batch-generate.ts [--start 0] [--count 50] [--dry-run]

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import prompts from './purple-prompts.json';

// Per-image environment contexts for more natural, less sterile look
const ENVIRONMENT_CONTEXTS: Record<number, string> = {
    8: "resting on a dusty wooden table in a dimly lit apothecary, scattered dried herbs around, warm candlelight reflections",
    9: "standing on a cracked marble counter in an old wine cellar, cobwebs catching faint light, aged wooden barrels behind",
    36: "growing from a crack in a weathered stone wall, morning dew on surrounding moss, soft fog in the background",
    37: "viewed from a shadowy corridor with worn stone floor tiles, dust particles floating in light beams, ancient atmosphere",
    38: "in a dark sculptor studio, clay-stained workbench underneath, scattered tools and fabric, single overhead light source",
    39: "stretching across a misty ravine between ancient cliff faces, faint rain falling, wet rocks glistening below, moonlight breaking through storm clouds above",
    40: "standing on a snow-dusted granite ledge overlooking a frozen valley at twilight, pine trees in soft focus behind, breath-like mist curling around its paws",
    41: "suspended in a deep ocean cavern with bioluminescent algae on the rock walls, shafts of pale light filtering from a crack in the ceiling above, tiny bubbles rising",
    42: "perched on a gnarled oak branch in a fog-heavy ancient forest, lichen and ivy climbing the trunk, scattered fallen leaves on the mossy ground below, overcast sky",
    43: "emerging from a bed of dark volcanic rock in a hidden grotto, mineral-rich water pooling around the base, stalactites dripping overhead, faint steam rising",
    44: "crouched on a frost-covered fallen log in a deep winter forest at golden hour, snow drifts around, bare birch trees fading into amber fog, tiny ice crystals sparkling on its fur",
    48: "prowling along a rain-slicked cobblestone alley in a forgotten European quarter at night, warm light spilling from a cracked doorway, puddles reflecting neon violet signs above, wet ivy on old brick walls",
    45: "standing in a moonlit clearing of an ancient pine forest, silver mist swirling at its hooves, ferns and wild violets carpeting the ground, distant mountains under a star-filled sky",
    46: "drifting near a sunken coral arch in a deep tropical lagoon, shafts of sunlight piercing the turquoise water, sea anemones and barnacles on the surrounding rocks, tiny silver fish schooling nearby",
    47: "resting on the petal of a giant water lily in a still jungle pond at dawn, morning mist hovering over the surface, dragonflies nearby, lush tropical foliage reflected in the dark water",
    49: "rooted in the mossy floor of a ruined cathedral overtaken by nature, broken stained glass windows filtering colored light, ivy climbing stone pillars, rain puddles on the ancient tiles around it",
};

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FAL_KEY = process.env.FAL_KEY!;
const IMPORT_USER_ID = process.env.IMPORT_USER_ID!;

// --- Model distribution: 70% flux-dev, 15% flux-pro, 15% banana ---
type ModelConfig = {
    endpoint: string;
    name: string;
};

const MODELS: { config: ModelConfig; weight: number }[] = [
    { config: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' }, weight: 0.70 },
    { config: { endpoint: 'fal-ai/flux-pro/v1.1', name: 'flux-pro' }, weight: 0.15 },
    { config: { endpoint: 'fal-ai/flux/schnell', name: 'flux/schnell' }, weight: 0.15 },
];

// --- Image sizes: varied ---
const IMAGE_SIZES = [
    'square_hd',       // 1024x1024
    'landscape_4_3',   // 1184x880
    'portrait_4_3',    // 880x1184
    'portrait_16_9',   // 768x1344
];

// Deterministic model assignment based on index
// Per-index model overrides
const MODEL_OVERRIDES: Record<number, ModelConfig> = {
    44: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' },
    48: { endpoint: 'fal-ai/nano-banana', name: 'nano-banana' },
    50: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    51: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    52: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    53: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    54: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    55: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    56: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    57: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    58: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    59: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    60: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    61: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
    62: { endpoint: 'fal-ai/flux/dev', name: 'flux/dev' },
};

function getModelForIndex(index: number): ModelConfig {
    if (MODEL_OVERRIDES[index]) return MODEL_OVERRIDES[index];
    // 0-34 -> flux-dev (35 items = 70%)
    // 35-41 -> flux-pro (7 items ~15%)
    // 42-49 -> flux/schnell (8 items ~15%)
    if (index < 35) return MODELS[0].config;
    if (index < 42) return MODELS[1].config;
    return MODELS[2].config;
}

// Varied sizes: cycle through sizes
function getSizeForIndex(index: number): string {
    return IMAGE_SIZES[index % IMAGE_SIZES.length];
}

// --- HSL-based color family mapping ---
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
    if (s < 10) { if (l < 20) return 'black'; if (l > 85) return 'white'; return 'brown'; }
    if (s < 25 && l < 35) return 'brown';
    if (l < 8) return 'black';
    if (l > 95) return 'white';
    if (h < 15) return 'red';
    if (h < 40) return 'orange';
    if (h < 65) return 'yellow';
    if (h < 160) return 'green';
    if (h < 185) return 'teal';
    if (h < 210) return 'cyan';
    if (h < 260) return 'blue';
    if (h < 290) return 'indigo';
    if (h < 330) return s > 40 && l > 40 ? 'pink' : 'purple';
    return 'red';
}

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

// --- Color positions ---
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
                positions.push({ hex: colors[ci], x: 0.2 + (ci * 0.15), y: 0.3 + (ci * 0.1) });
            }
        }

        // Separate close markers
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

// --- Generate image via fal.ai ---
async function generateImage(prompt: string, endpoint: string, imageSize: string): Promise<{
    url: string;
    width: number;
    height: number;
    seed: string;
} | null> {
    console.log(`   Calling ${endpoint} with size=${imageSize}...`);

    // nano-banana uses aspect_ratio ("1:1", "4:3") instead of image_size ("square_hd")
    const isNanoBanana = endpoint.includes('nano-banana');
    const sizeToAspect: Record<string, string> = {
        'square_hd': '1:1',
        'landscape_4_3': '4:3',
        'landscape_16_9': '16:9',
        'portrait_4_3': '3:4',
        'portrait_16_9': '9:16',
    };

    const body: any = {
        prompt,
        num_images: 1,
    };
    if (isNanoBanana) {
        body.aspect_ratio = sizeToAspect[imageSize] ?? '1:1';
    } else {
        body.image_size = imageSize;
        body.enable_safety_checker = false;
    }

    const res = await fetch(`https://queue.fal.run/${endpoint}`, {
        method: 'POST',
        headers: {
            'Authorization': `Key ${FAL_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        console.error(`   fal.ai error ${res.status}:`, await res.text().catch(() => ''));
        return null;
    }

    const data = await res.json();

    // Handle queue response — use URLs from fal.ai response directly
    if (data.request_id && !data.images) {
        return await pollForResult(data.status_url, data.response_url);
    }

    const img = data.images?.[0];
    if (!img?.url) {
        console.error('   No image in response');
        return null;
    }

    return {
        url: img.url,
        width: img.width,
        height: img.height,
        seed: data.seed?.toString() ?? null,
    };
}

async function pollForResult(statusUrl: string, responseUrl: string): Promise<{
    url: string;
    width: number;
    height: number;
    seed: string;
} | null> {
    console.log(`   Queued, polling...`);
    const maxAttempts = 60; // 5 minutes max

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(r => setTimeout(r, 5000));

        const statusRes = await fetch(statusUrl, {
            headers: { 'Authorization': `Key ${FAL_KEY}` },
        });
        const statusText = await statusRes.text();
        let status: any;
        try { status = JSON.parse(statusText); } catch {
            console.error(`   Bad status response: ${statusText.substring(0, 100)}`);
            continue;
        }

        if (status.status === 'COMPLETED') {
            const resultRes = await fetch(responseUrl, {
                headers: { 'Authorization': `Key ${FAL_KEY}` },
            });
            const data = await resultRes.json();
            const img = data.images?.[0];
            if (!img?.url) return null;
            return {
                url: img.url,
                width: img.width,
                height: img.height,
                seed: data.seed?.toString() ?? null,
            };
        }

        if (status.status === 'FAILED') {
            console.error(`   Generation failed: ${status.error}`);
            return null;
        }

        process.stdout.write('.');
    }

    console.error('   Timeout waiting for generation');
    return null;
}

// --- Category to tags ---
function categoryToTags(category: string): string[] {
    const base = ['purple', 'ai-generated'];
    const map: Record<string, string[]> = {
        'Atmospheric Capture': ['atmospheric', 'glass', 'weather', 'magical-realism'],
        'Holographic Antiquity': ['holographic', 'ancient', 'marble', 'cyber-classical'],
        'Fragile Interiors': ['porcelain', 'ceramic', 'fragile', 'glow'],
        'Solid Light': ['light', 'luminous', 'architectural', 'surreal'],
        'Crystal Organisms': ['crystal', 'gemstone', 'organic', 'creature'],
    };
    return [...base, ...(map[category] ?? [])];
}

// --- Main ---
async function main() {
    const args = process.argv.slice(2);
    const startIdx = parseInt(args.find((_, i, a) => a[i - 1] === '--start') ?? '0');
    const count = parseInt(args.find((_, i, a) => a[i - 1] === '--count') ?? '50');
    const dryRun = args.includes('--dry-run');

    const slice = prompts.slice(startIdx, startIdx + count);
    console.log(`\n=== Batch Generate: ${slice.length} images ===`);
    console.log(`Start: ${startIdx}, Count: ${count}, Dry run: ${dryRun}\n`);

    let success = 0;
    let failed = 0;

    for (let i = 0; i < slice.length; i++) {
        const globalIdx = startIdx + i;
        const p = slice[i];
        const model = getModelForIndex(globalIdx);
        const imageSize = getSizeForIndex(globalIdx);

        console.log(`\n[${i + 1}/${slice.length}] ${p.id} "${p.title}"`);
        console.log(`   Model: ${model.name}, Size: ${imageSize}`);

        if (dryRun) {
            console.log(`   [DRY RUN] Would generate with private prompt`);
            console.log(`   Public: ${p.public.substring(0, 60)}...`);
            continue;
        }

        try {
            // 1. Generate image via fal.ai using PUBLIC prompt (color names work better)
            // Add per-image environment context for more natural look
            const envContext = (ENVIRONMENT_CONTEXTS as Record<number, string>)[globalIdx] ?? "";
            const fullPrompt = envContext ? p.public + ", " + envContext : p.public;
            const result = await generateImage(fullPrompt, model.endpoint, imageSize);
            if (!result) {
                console.error(`   FAILED to generate`);
                failed++;
                continue;
            }
            console.log(`   Generated: ${result.width}x${result.height}, seed=${result.seed}`);

            // 2. Download image (with retry for DNS flakes)
            let imageBuffer: Buffer | null = null;
            for (let dl = 0; dl < 3; dl++) {
                try {
                    const imgRes = await fetch(result.url);
                    if (!imgRes.ok) {
                        console.error(`   Download attempt ${dl + 1} failed: ${imgRes.status}`);
                        await new Promise(r => setTimeout(r, 2000));
                        continue;
                    }
                    imageBuffer = Buffer.from(await imgRes.arrayBuffer());
                    break;
                } catch (dlErr: any) {
                    console.error(`   Download attempt ${dl + 1} error: ${dlErr.message}`);
                    await new Promise(r => setTimeout(r, 3000));
                }
            }
            if (!imageBuffer) {
                console.error(`   FAILED to download after 3 attempts`);
                failed++;
                continue;
            }
            console.log(`   Downloaded: ${(imageBuffer.length / 1024).toFixed(0)} KB`);

            // 3. Extract colors
            const colors = await extractColors(imageBuffer, 5);
            console.log(`   Colors: ${colors.join(', ')}`);

            // 4. Get NTC names
            let colorNames: string[] = [];
            try {
                const namer = (await import('color-namer')).default;
                colorNames = colors.map((hex) => {
                    try { return namer(hex).ntc[0]?.name ?? ''; } catch { return ''; }
                }).filter(Boolean);
            } catch { }

            // 5. Get families
            const colorFamilies = colors.map(hexToFamily);

            // 6. Find color positions
            const colorPositions = await findColorPositions(imageBuffer, colors);

            // 7. Upload to Supabase Storage
            const safeTitle = p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
            const fileName = `purple_${safeTitle}_${Date.now()}.jpg`;
            const storagePath = `uploads/${fileName}`;

            const { error: uploadError } = await supabase
                .storage
                .from('images')
                .upload(storagePath, imageBuffer, {
                    contentType: 'image/jpeg',
                    upsert: false,
                });

            if (uploadError) {
                console.error(`   Upload error:`, uploadError.message);
                failed++;
                continue;
            }

            // 8. Calculate aspect ratio
            const aspectRatio = result.width && result.height
                ? getAspectRatioString(result.width, result.height)
                : null;

            // 9. Build tags
            const tags = categoryToTags(p.category);

            // 10. Insert into images_meta with BOTH prompts
            const row = {
                user_id: IMPORT_USER_ID,
                path: storagePath,
                title: p.title,
                description: null,
                prompt: fullPrompt,
                private_prompt: p.private,
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
                model: model.name,
                seed: result.seed,
                source: null,
                source_author: null,
                source_url: result.url,
                tags,
            };

            const { data, error: insertError } = await supabase
                .from('images_meta')
                .insert(row)
                .select('id');

            if (insertError) {
                console.error(`   DB insert error:`, insertError.message);
                failed++;
                continue;
            }

            console.log(`   OK! ID: ${data?.[0]?.id} | ${storagePath}`);
            success++;

        } catch (err: any) {
            console.error(`   ERROR: ${err.message}`);
            failed++;
        }
    }

    console.log(`\n=== Done! Success: ${success}, Failed: ${failed} ===\n`);
}

main().catch(console.error);
