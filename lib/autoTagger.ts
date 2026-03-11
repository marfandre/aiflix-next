// lib/autoTagger.ts
// Auto-tagging: Imagga (primary) → CLIP fallback when Imagga quota is exhausted.

const GENERIC_TAGS = ['no person', 'one person', 'horizontal', 'vertical', 'image'];

// ─── Predefined tag lists for CLIP (from ai_tags_v1_1_full.txt) ─────────────
// We keep only English labels, grouped by category for batched CLIP requests.

const CLIP_GENRE_TAGS = [
    'sci-fi', 'fantasy', 'cyberpunk', 'steampunk', 'solarpunk', 'dieselpunk',
    'post-apocalyptic', 'dystopian', 'utopian', 'horror', 'dark fantasy',
    'space opera', 'noir', 'western', 'medieval', 'historical', 'mythological',
    'surrealism', 'abstract', 'realism', 'hyperrealism', 'minimalism',
    'brutalism', 'gothic', 'baroque', 'art deco', 'retro', 'vintage',
    'vaporwave', 'synthwave', 'anime', 'manga', 'comic', 'illustration',
    'digital art', 'concept art', 'concept design', 'environment art',
    'character design', 'watercolor', 'oil painting', 'sketch', 'low poly',
    'pixel art', 'photorealistic', 'AI art', 'cinematic', 'space art',
    'science fantasy', 'dark sci-fi', 'isometric', '3D render', 'matte painting',
];

const CLIP_MOOD_TAGS = [
    'calm', 'peaceful', 'cozy', 'warm', 'cold', 'dark', 'gloomy', 'eerie',
    'mysterious', 'dreamy', 'epic', 'dramatic', 'melancholic', 'romantic',
    'nostalgic', 'magical', 'mystical', 'vibrant', 'muted', 'minimal',
    'clean', 'chaotic', 'intense', 'soft', 'moody', 'quiet', 'lonely',
    'hopeful', 'sad', 'happy', 'playful', 'ominous', 'brutal', 'elegant',
    'luxurious', 'apocalyptic', 'ethereal', 'foggy', 'rainy', 'stormy',
    'snowy', 'glowing', 'neon', 'serene', 'emotional', 'poetic', 'cosmic',
    'vast', 'isolated', 'tranquil', 'awe', 'silent', 'uncanny', 'golden hour',
];

const CLIP_SCENE_TAGS = [
    'portrait', 'landscape', 'close-up', 'wide shot', 'forest', 'jungle',
    'desert', 'mountains', 'ocean', 'sea', 'beach', 'island', 'river',
    'lake', 'waterfall', 'cave', 'volcano', 'sky', 'clouds', 'sunset',
    'sunrise', 'night sky', 'stars', 'galaxy', 'planet', 'moon',
    'outer space', 'space station', 'alien planet', 'asteroid', 'orbit',
    'city', 'cityscape', 'street', 'road', 'bridge', 'skyscraper',
    'building', 'house', 'village', 'ruins', 'abandoned city',
    'futuristic city', 'room', 'corridor', 'library', 'laboratory',
    'temple', 'castle', 'palace', 'human', 'silhouette', 'astronaut',
    'robot', 'android', 'cyborg', 'alien', 'creature', 'dragon', 'angel',
    'demon', 'fire', 'smoke', 'fog', 'portal', 'spaceship',
    'spaceship interior', 'vehicle', 'car', 'train', 'ship', 'tower',
    'monument', 'interior', 'aerial view', 'underwater', 'floating islands',
    'mech', 'weapon',
];

// ─── Shared helpers ─────────────────────────────────────────────────────────

function filterRawTags(
    rawTags: any[],
    limit: number,
    confidenceThreshold: number
): string[] {
    return rawTags
        .filter((t: any) => t.confidence >= confidenceThreshold)
        .map((t: any) => t.tag.en.toLowerCase().trim())
        .filter((name: string) => !GENERIC_TAGS.includes(name))
        .slice(0, limit);
}

function getImaggaAuth(): string | null {
    const apiKey = process.env.IMAGGA_API_KEY;
    const apiSecret = process.env.IMAGGA_API_SECRET;
    if (!apiKey || !apiSecret) return null;
    return Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
}

// ─── CLIP-based tagging (fallback) ──────────────────────────────────────────

/**
 * Run CLIP zero-shot classification on an image against a batch of candidate labels.
 * Returns labels sorted by score descending.
 */
async function clipClassifyBatch(
    imageBase64: string,
    candidateLabels: string[],
    hfToken: string,
): Promise<{ label: string; score: number }[]> {
    const response = await fetch(
        'https://router.huggingface.co/hf-inference/models/openai/clip-vit-base-patch32',
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${hfToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: imageBase64,
                parameters: { candidate_labels: candidateLabels },
            }),
        }
    );

    if (!response.ok) {
        console.warn(`CLIP API error (${response.status}):`, await response.text());
        return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    // HF returns [{ label, score }] sorted by score desc
    return data as { label: string; score: number }[];
}

/**
 * Generate tags using CLIP zero-shot classification.
 * Sends 3 batched requests (genre, mood, scene) and picks top results from each.
 */
async function generateTagsViaCLIP(
    imageBase64: string,
    limit: number = 5,
): Promise<string[]> {
    const hfToken = process.env.HUGGINGFACE_API_TOKEN;
    if (!hfToken) {
        console.warn('HUGGINGFACE_API_TOKEN not set, CLIP tagging skipped.');
        return [];
    }

    try {
        // Run 3 category batches in parallel
        const [genreResults, moodResults, sceneResults] = await Promise.all([
            clipClassifyBatch(imageBase64, CLIP_GENRE_TAGS, hfToken),
            clipClassifyBatch(imageBase64, CLIP_MOOD_TAGS, hfToken),
            clipClassifyBatch(imageBase64, CLIP_SCENE_TAGS, hfToken),
        ]);

        // Take top-2 from each category (if score > 0.05)
        const MIN_CLIP_SCORE = 0.05;
        const topGenre = genreResults.filter(r => r.score > MIN_CLIP_SCORE).slice(0, 2);
        const topMood = moodResults.filter(r => r.score > MIN_CLIP_SCORE).slice(0, 2);
        const topScene = sceneResults.filter(r => r.score > MIN_CLIP_SCORE).slice(0, 2);

        const allTags = [...topGenre, ...topMood, ...topScene]
            .sort((a, b) => b.score - a.score)
            .map(r => r.label.toLowerCase());

        console.log(`CLIP tags: ${allTags.join(', ')}`);

        // Deduplicate and limit
        return [...new Set(allTags)].slice(0, limit);
    } catch (err) {
        console.error('CLIP tagging error:', err);
        return [];
    }
}

/**
 * Convert a File/Blob to base64 string.
 */
async function fileToBase64(file: File | Blob): Promise<string> {
    const buffer = await file.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
}

// ─── Imagga-based tagging (primary) ─────────────────────────────────────────

/**
 * Try Imagga tagging with a file upload.
 * Returns tags on success, or null if quota exhausted / credentials missing (to trigger fallback).
 */
async function tryImaggaFile(
    file: File | Blob,
    limit: number,
    confidenceThreshold: number,
): Promise<string[] | null> {
    const auth = getImaggaAuth();
    if (!auth) return null; // No credentials → fallback

    try {
        const formData = new FormData();
        formData.append("image", file);

        const response = await fetch(
            "https://api.imagga.com/v2/tags?limit=10&language=en",
            {
                method: "POST",
                headers: { Authorization: `Basic ${auth}` },
                body: formData,
            }
        );

        // Quota exhausted or auth error → fallback to CLIP
        if (response.status === 429 || response.status === 403) {
            console.warn(`Imagga quota exhausted (${response.status}), falling back to CLIP.`);
            return null;
        }

        if (!response.ok) {
            console.warn(`Imagga API error (${response.status}):`, await response.text());
            return null;
        }

        const data = await response.json();
        const rawTags = data?.result?.tags;
        if (!Array.isArray(rawTags)) return [];

        return filterRawTags(rawTags, limit, confidenceThreshold);
    } catch (err) {
        console.error("Imagga tagging error:", err);
        return null; // Network error → fallback
    }
}

/**
 * Try Imagga tagging with an image URL.
 * Returns tags on success, or null to trigger CLIP fallback.
 */
async function tryImaggaUrl(
    imageUrl: string,
    limit: number,
    confidenceThreshold: number,
): Promise<string[] | null> {
    const auth = getImaggaAuth();
    if (!auth) return null;

    try {
        const response = await fetch(
            `https://api.imagga.com/v2/tags?image_url=${encodeURIComponent(imageUrl)}&limit=10&language=en`,
            {
                method: "GET",
                headers: { Authorization: `Basic ${auth}` },
            }
        );

        if (response.status === 429 || response.status === 403) {
            console.warn(`Imagga quota exhausted (${response.status}), falling back to CLIP.`);
            return null;
        }

        if (!response.ok) {
            console.warn(`Imagga API error (${response.status}):`, await response.text());
            return null;
        }

        const data = await response.json();
        const rawTags = data?.result?.tags;
        if (!Array.isArray(rawTags)) return [];

        return filterRawTags(rawTags, limit, confidenceThreshold);
    } catch (err) {
        console.error("Imagga tagging error:", err);
        return null;
    }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate tags from an image URL.
 * Strategy: Imagga first → CLIP fallback.
 */
export async function generateAITags(
    imageUrl: string,
    limit: number = 5,
    confidenceThreshold: number = 30
): Promise<string[]> {
    // 1. Try Imagga
    const imaggaTags = await tryImaggaUrl(imageUrl, limit, confidenceThreshold);
    if (imaggaTags !== null) return imaggaTags;

    // 2. Fallback: CLIP (need to download image and convert to base64)
    console.log('Falling back to CLIP tagging for URL:', imageUrl);
    try {
        const imgResponse = await fetch(imageUrl);
        if (!imgResponse.ok) return [];
        const buffer = await imgResponse.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        return generateTagsViaCLIP(base64, limit);
    } catch (err) {
        console.error('CLIP fallback error:', err);
        return [];
    }
}

/**
 * Generate tags from a file upload (File/Blob).
 * Strategy: Imagga first → CLIP fallback.
 */
export async function generateAITagsFromFile(
    file: File | Blob,
    limit: number = 5,
    confidenceThreshold: number = 30
): Promise<string[]> {
    // 1. Try Imagga
    const imaggaTags = await tryImaggaFile(file, limit, confidenceThreshold);
    if (imaggaTags !== null) return imaggaTags;

    // 2. Fallback: CLIP
    console.log('Falling back to CLIP tagging for uploaded file.');
    const base64 = await fileToBase64(file);
    return generateTagsViaCLIP(base64, limit);
}
