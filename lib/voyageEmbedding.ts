// lib/voyageEmbedding.ts
// Voyage AI multimodal-3.5 (1024 dims)
// Мультимодальная модель: текст + изображения в одном векторном пространстве.
// Документация: https://docs.voyageai.com/docs/multimodal-embeddings

const VOYAGE_BASE_URL = process.env.VOYAGE_PROXY_URL?.replace(/\/$/, "") ?? "https://api.voyageai.com";
const VOYAGE_API_URL = `${VOYAGE_BASE_URL}/v1/multimodalembeddings`;
const VOYAGE_MODEL = "voyage-multimodal-3.5";
const EMBEDDING_DIMS = 1024;

function getApiKey(): string {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("Missing VOYAGE_API_KEY in environment");
  return key;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type VoyageInputType = "document" | "query" | null;

type VoyageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: string }
  | { type: "image_base64"; image_base64: string };

type VoyageRequest = {
  inputs: { content: VoyageContentPart[] }[];
  model: string;
  input_type?: VoyageInputType;
  truncation?: boolean;
};

async function callVoyage(
  body: VoyageRequest,
  maxRetries = 5
): Promise<number[][] | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(VOYAGE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify(body),
      });

      if (res.status === 429 && attempt < maxRetries) {
        const waitSec = Math.min(10 * (attempt + 1), 60);
        console.warn(`[Voyage] Rate limited, waiting ${waitSec}s (attempt ${attempt + 1}/${maxRetries})...`);
        await sleep(waitSec * 1000);
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        console.error(`[Voyage] API error ${res.status}:`, text);
        return null;
      }

      const json = await res.json();
      const data: { embedding: number[]; index: number }[] = json.data ?? [];
      if (!data.length) {
        console.error("[Voyage] Empty data in response");
        return null;
      }

      const result: number[][] = new Array(body.inputs.length);
      for (const item of data) {
        if (item.embedding?.length === EMBEDDING_DIMS) {
          result[item.index] = item.embedding;
        }
      }
      return result;
    } catch (err) {
      console.error("[Voyage] fetch error:", err);
      if (attempt >= maxRetries) return null;
      await sleep(2000 * (attempt + 1));
    }
  }
  return null;
}

/**
 * Эмбеддинг изображения по URL.
 * input_type="document" — для индексации (recommended).
 */
export async function getImageEmbedding(
  imageUrl: string
): Promise<number[] | null> {
  const result = await callVoyage({
    model: VOYAGE_MODEL,
    input_type: "document",
    inputs: [
      {
        content: [{ type: "image_url", image_url: imageUrl }],
      },
    ],
  });
  return result?.[0] ?? null;
}

/**
 * Эмбеддинг изображения из Buffer (base64 data URI).
 */
export async function getImageEmbeddingFromBuffer(
  buffer: Buffer,
  mime: string = "image/jpeg"
): Promise<number[] | null> {
  const base64 = buffer.toString("base64");
  const dataUri = `data:${mime};base64,${base64}`;

  const result = await callVoyage({
    model: VOYAGE_MODEL,
    input_type: "document",
    inputs: [
      {
        content: [{ type: "image_base64", image_base64: dataUri }],
      },
    ],
  });
  return result?.[0] ?? null;
}

/**
 * Текстовый эмбеддинг для поискового запроса.
 * input_type="query" — добавляет префикс "Represent the query..." внутри Voyage.
 */
export async function getTextEmbedding(
  text: string
): Promise<number[] | null> {
  const result = await callVoyage({
    model: VOYAGE_MODEL,
    input_type: "query",
    inputs: [
      {
        content: [{ type: "text", text }],
      },
    ],
  });
  return result?.[0] ?? null;
}

/**
 * Batch: эмбеддинги нескольких изображений за один запрос.
 * Voyage multimodal: до 1000 inputs, 320k tokens total.
 */
export async function getImageEmbeddingsBatch(
  imageUrls: string[]
): Promise<(number[] | null)[]> {
  if (imageUrls.length === 0) return [];

  const result = await callVoyage({
    model: VOYAGE_MODEL,
    input_type: "document",
    inputs: imageUrls.map((url) => ({
      content: [{ type: "image_url", image_url: url }],
    })),
  });

  if (!result) return imageUrls.map(() => null);
  return imageUrls.map((_, i) => result[i] ?? null);
}

export const VOYAGE_EMBEDDING_DIMS = EMBEDDING_DIMS;
