// lib/localEmbedding.ts
// Локальные multimodal-эмбеддинги через Jina CLIP v1 (768 dims).
// Jina CLIP v1 использует split ONNX (text_model.onnx + vision_model.onnx),
// поэтому грузим два отдельных энкодера.
// Модель скачивается с HuggingFace при первом использовании (~300MB text + ~350MB vision)
// и кешируется в ~/.cache/huggingface. Дальше всё офлайн, CPU-инференс.

import {
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  AutoTokenizer,
  AutoProcessor,
  RawImage,
  type PreTrainedTokenizer,
  type Processor,
} from "@huggingface/transformers";

const MODEL_ID = "jinaai/jina-clip-v1";
export const LOCAL_EMBEDDING_DIMS = 768;

let textModelPromise: Promise<{
  model: any;
  tokenizer: PreTrainedTokenizer;
}> | null = null;

let visionModelPromise: Promise<{
  model: any;
  processor: Processor;
}> | null = null;

async function getTextModel() {
  if (!textModelPromise) {
    console.log("[LocalEmbed] Loading Jina CLIP v1 text encoder...");
    textModelPromise = (async () => {
      const model = await CLIPTextModelWithProjection.from_pretrained(MODEL_ID, {
        dtype: "fp32",
        model_file_name: "text_model",
      } as any);
      const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
      console.log("[LocalEmbed] Text encoder ready");
      return { model, tokenizer };
    })();
  }
  return textModelPromise;
}

async function getVisionModel() {
  if (!visionModelPromise) {
    console.log("[LocalEmbed] Loading Jina CLIP v1 vision encoder...");
    visionModelPromise = (async () => {
      const model = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
        dtype: "fp32",
        model_file_name: "vision_model",
      } as any);
      const processor = await AutoProcessor.from_pretrained(MODEL_ID);
      console.log("[LocalEmbed] Vision encoder ready");
      return { model, processor };
    })();
  }
  return visionModelPromise;
}

function l2normalize(vec: number[]): number[] {
  let sum = 0;
  for (const v of vec) sum += v * v;
  const norm = Math.sqrt(sum) || 1;
  return vec.map((v) => v / norm);
}

/**
 * Текстовый эмбеддинг запроса (для поиска).
 */
export async function getTextEmbedding(text: string): Promise<number[] | null> {
  try {
    const { model, tokenizer } = await getTextModel();
    const inputs = await tokenizer(text, { padding: true, truncation: true });
    const output = await model(inputs);
    const data = Array.from(output.text_embeds.data as Float32Array);
    return l2normalize(data as number[]);
  } catch (err) {
    console.error("[LocalEmbed] text error:", err);
    return null;
  }
}

/**
 * Эмбеддинг изображения из Buffer.
 */
export async function getImageEmbeddingFromBuffer(
  buffer: Buffer
): Promise<number[] | null> {
  try {
    const { model, processor } = await getVisionModel();
    const blob = new Blob([buffer as any]);
    const image = await RawImage.fromBlob(blob);
    const imageProcessor = (processor as any).components?.image_processor;
    if (!imageProcessor) throw new Error("image_processor component not found");
    const inputs = await imageProcessor(image);
    const output = await model({ pixel_values: inputs.pixel_values });
    const data = Array.from(output.image_embeds.data as Float32Array);
    return l2normalize(data as number[]);
  } catch (err) {
    console.error("[LocalEmbed] image buffer error:", err);
    return null;
  }
}

/**
 * Эмбеддинг изображения по URL (сначала скачиваем).
 */
export async function getImageEmbedding(imageUrl: string): Promise<number[] | null> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      console.error(`[LocalEmbed] image fetch ${res.status} for ${imageUrl}`);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    return getImageEmbeddingFromBuffer(buffer);
  } catch (err) {
    console.error("[LocalEmbed] image url error:", err);
    return null;
  }
}
