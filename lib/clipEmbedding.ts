// lib/clipEmbedding.ts
// Локальный CLIP inference через @huggingface/transformers (ONNX)
// Модель: Xenova/clip-vit-base-patch32 (512 dims)
// Используется для семантического поиска (текст ↔ изображение)
//
// Как это работает:
// 1. CLIP — модель, которая «понимает» и текст, и изображения в одном пространстве
// 2. Текст "blue ocean" и фото синего океана будут иметь похожие векторы (512 чисел)
// 3. Cosine similarity между векторами показывает семантическую близость
// 4. pgvector в PostgreSQL ищет ближайшие векторы за O(log n)

import type { Tensor } from "@huggingface/transformers";

const MODEL_ID = "Xenova/clip-vit-base-patch32";

// Синглтоны — модели загружаются один раз (~87MB ONNX) и кешируются
let _visionModel: any = null;
let _textModel: any = null;
let _processor: any = null;
let _tokenizer: any = null;

// Ленивый импорт transformers (heavy module)
async function getTransformers() {
  return await import("@huggingface/transformers");
}

/** Загрузить vision модель + processor (singleton) */
async function getVisionModel() {
  if (!_visionModel) {
    const {
      CLIPVisionModelWithProjection,
      AutoProcessor,
    } = await getTransformers();

    console.log(`[CLIP] Loading vision model: ${MODEL_ID}...`);
    [_visionModel, _processor] = await Promise.all([
      CLIPVisionModelWithProjection.from_pretrained(MODEL_ID),
      AutoProcessor.from_pretrained(MODEL_ID),
    ]);
    console.log("[CLIP] Vision model ready");
  }
  return { model: _visionModel, processor: _processor };
}

/** Загрузить text модель + tokenizer (singleton) */
async function getTextModel() {
  if (!_textModel) {
    const {
      CLIPTextModelWithProjection,
      AutoTokenizer,
    } = await getTransformers();

    console.log(`[CLIP] Loading text model: ${MODEL_ID}...`);
    [_textModel, _tokenizer] = await Promise.all([
      CLIPTextModelWithProjection.from_pretrained(MODEL_ID),
      AutoTokenizer.from_pretrained(MODEL_ID),
    ]);
    console.log("[CLIP] Text model ready");
  }
  return { model: _textModel, tokenizer: _tokenizer };
}

/** Нормализовать вектор (L2 norm) — нужно для cosine similarity */
function normalizeVector(vec: number[]): number[] {
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

/** Tensor → number[] */
function tensorToArray(tensor: Tensor): number[] {
  return Array.from(tensor.data as Float32Array);
}

/**
 * Получить эмбеддинг изображения по URL
 * Возвращает нормализованный вектор из 512 чисел
 *
 * Как работает:
 * 1. RawImage.read(url) скачивает и декодирует картинку
 * 2. processor ресайзит до 224×224 и нормализует пиксели
 * 3. CLIPVisionModelWithProjection прогоняет через нейросеть
 * 4. На выходе — 512-мерный вектор, описывающий «смысл» картинки
 */
export async function getImageEmbedding(
  imageUrl: string
): Promise<number[] | null> {
  try {
    const { RawImage } = await getTransformers();
    const { model, processor } = await getVisionModel();

    // RawImage умеет загружать по URL, из файла, из Blob
    const image = await RawImage.read(imageUrl);
    const inputs = await processor(image);

    // image_embeds: Tensor { dims: [1, 512], data: Float32Array }
    const { image_embeds } = await model(inputs);
    return normalizeVector(tensorToArray(image_embeds));
  } catch (err) {
    console.error("getImageEmbedding error:", err);
    return null;
  }
}

/**
 * Получить эмбеддинг изображения из Buffer
 */
export async function getImageEmbeddingFromBuffer(
  buffer: Buffer
): Promise<number[] | null> {
  try {
    const { RawImage } = await getTransformers();
    const { model, processor } = await getVisionModel();

    // RawImage.fromBlob работает с Blob, создаём его из Buffer
    const blob = new Blob([new Uint8Array(buffer)]);
    const image = await RawImage.fromBlob(blob);
    const inputs = await processor(image);

    const { image_embeds } = await model(inputs);
    return normalizeVector(tensorToArray(image_embeds));
  } catch (err) {
    console.error("getImageEmbeddingFromBuffer error:", err);
    return null;
  }
}

/**
 * Получить текстовый эмбеддинг через CLIP
 *
 * Магия CLIP: текст и картинки живут в ОДНОМ пространстве.
 * "blue ocean" → вектор близкий к фото синего океана
 * "red car" → вектор близкий к фото красной машины
 *
 * Это позволяет искать картинки по текстовому описанию!
 */
export async function getTextEmbedding(
  text: string
): Promise<number[] | null> {
  try {
    const { model, tokenizer } = await getTextModel();

    // Токенизация: "blue ocean" → [49406, 1539, 4318, 49407, ...]
    const inputs = tokenizer([text], { padding: true, truncation: true });

    // text_embeds: Tensor { dims: [1, 512], data: Float32Array }
    const { text_embeds } = await model(inputs);
    return normalizeVector(tensorToArray(text_embeds));
  } catch (err) {
    console.error("getTextEmbedding error:", err);
    return null;
  }
}

/**
 * Cosine similarity между двумя векторами
 *
 * Для нормализованных векторов cosine similarity = dot product
 * Значения: 1.0 = идентичны, 0 = ортогональны, -1 = противоположны
 * Типичные пороги для CLIP: > 0.25 — похожи, > 0.3 — очень похожи
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
