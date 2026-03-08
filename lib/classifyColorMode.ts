// lib/classifyColorMode.ts
// Автоматическое определение цветового режима для видео
// CLIP определяет, нужны ли цвета (none vs static)
// По умолчанию — static (кружок с палитрой)

type ColorMode = 'static' | 'none';

// Текстовые якоря для CLIP классификации
const REJECT_LABELS = [
    'a meme with text overlay and reaction image',
    'a low quality blurry or noisy image',
    'a screenshot of a chat, social media, or user interface',
    'a photo of text, document, or presentation slide',
    'a black and white or grayscale photograph',
    'a simple logo or graphic design with flat solid colors',
];

const ACCEPT_LABELS = [
    'a cinematic scene with beautiful vivid colors and dramatic lighting',
    'an artistic photograph or digital art with rich color palette',
    'a colorful landscape, nature, architecture, or abstract scene',
];

const ALL_LABELS = [...REJECT_LABELS, ...ACCEPT_LABELS];

/**
 * CLIP классификация через Hugging Face Inference API.
 * Возвращает top-label и score, или null если API недоступен.
 */
async function clipClassify(
    imageUrl: string
): Promise<{ label: string; score: number; isReject: boolean } | null> {
    const token = process.env.HUGGINGFACE_API_TOKEN;
    if (!token) {
        console.warn('HUGGINGFACE_API_TOKEN not set, skipping CLIP classification');
        return null;
    }

    try {
        // Скачиваем изображение и конвертируем в base64
        const imgResponse = await fetch(imageUrl);
        if (!imgResponse.ok) {
            console.error(`Failed to fetch image for CLIP: ${imgResponse.status}`);
            return null;
        }
        const imgBuffer = await imgResponse.arrayBuffer();
        const base64 = Buffer.from(imgBuffer).toString('base64');

        // Вызываем CLIP через Hugging Face Inference API
        const response = await fetch(
            'https://router.huggingface.co/hf-inference/models/openai/clip-vit-base-patch32',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: base64,
                    parameters: {
                        candidate_labels: ALL_LABELS,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`CLIP API error (${response.status}): ${errorText}`);
            return null;
        }

        const data = await response.json();

        // HF возвращает: [{ label: string, score: number }, ...]
        // Отсортировано по убыванию score
        if (!Array.isArray(data) || data.length === 0) {
            console.error('Unexpected CLIP response format:', data);
            return null;
        }

        const topResult = data[0];
        const isReject = REJECT_LABELS.includes(topResult.label);

        console.log(`CLIP result: "${topResult.label}" (score: ${topResult.score.toFixed(3)}, reject: ${isReject})`);

        return {
            label: topResult.label,
            score: topResult.score,
            isReject,
        };
    } catch (err) {
        console.error('CLIP classification error:', err);
        return null;
    }
}

/**
 * Определяет color_mode для видео.
 * CLIP отсеивает мусор (мемы, ЧБ, скриншоты) → none.
 * Всё остальное → static (кружок с палитрой).
 *
 * @param playbackId — Mux playback ID для получения thumbnail
 * @returns ColorMode — 'static' или 'none'
 */
export async function classifyColorMode(
    playbackId: string,
): Promise<{ colorMode: ColorMode; clipLabel?: string; clipScore?: number }> {
    const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1`;
    const clipResult = await clipClassify(thumbnailUrl);

    if (clipResult) {
        // Если CLIP уверенно говорит "reject" (мемы, скриншоты, ч/б и т.д.)
        if (clipResult.isReject && clipResult.score > 0.3) {
            console.log(`Color mode: NONE (CLIP rejected: "${clipResult.label}", score: ${clipResult.score.toFixed(3)})`);
            return {
                colorMode: 'none',
                clipLabel: clipResult.label,
                clipScore: clipResult.score,
            };
        }
    }

    // По умолчанию — static (палитра стабильна для 95%+ AI-видео)
    console.log(`Color mode: STATIC (default)`);
    return {
        colorMode: 'static',
        clipLabel: clipResult?.label,
        clipScore: clipResult?.score,
    };
}
