// lib/jinaEmbedding.ts
// Jina Embeddings v3 API (1024 dims)
// Мультимодальная модель: текст + изображения в одном пространстве
// Документация: https://jina.ai/embeddings

const JINA_API_URL = "https://api.jina.ai/v1/embeddings";
const JINA_MODEL = "jina-clip-v2";
const EMBEDDING_DIMS = 1024;

function getApiKey(): string {
  const key = process.env.JINA_API_KEY;
  if (!key) throw new Error("Missing JINA_API_KEY in environment");
  return key;
}

/** Вспомогательная функция: sleep */
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Получить эмбеддинг изображения по URL через Jina API
 * Возвращает нормализованный вектор из 1024 чисел
 * При 429 (rate limit) — автоматический retry с паузой
 */
export async function getImageEmbedding(
  imageUrl: string,
  maxRetries = 5
): Promise<number[] | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(JINA_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify({
          model: JINA_MODEL,
          dimensions: EMBEDDING_DIMS,
          normalized: true,
          input: [{ image: imageUrl }],
        }),
      });

      if (res.status === 429 && attempt < maxRetries) {
        const waitSec = Math.min(15 * (attempt + 1), 60);
        console.warn(`[Jina] Rate limited, waiting ${waitSec}s (attempt ${attempt + 1}/${maxRetries})...`);
        await sleep(waitSec * 1000);
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        console.error(`[Jina] Image embedding error ${res.status}:`, text);
        return null;
      }

      const json = await res.json();
      const embedding: number[] = json.data?.[0]?.embedding;
      if (!embedding || embedding.length !== EMBEDDING_DIMS) {
        console.error("[Jina] Unexpected embedding shape:", embedding?.length);
        return null;
      }

      return embedding;
    } catch (err) {
      console.error("[Jina] getImageEmbedding error:", err);
      return null;
    }
  }
  return null;
}

/**
 * Получить эмбеддинг изображения из Buffer (base64)
 */
export async function getImageEmbeddingFromBuffer(
  buffer: Buffer
): Promise<number[] | null> {
  try {
    const base64 = buffer.toString("base64");
    const dataUri = `data:image/jpeg;base64,${base64}`;

    const res = await fetch(JINA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({
        model: JINA_MODEL,
        dimensions: EMBEDDING_DIMS,
        normalized: true,
        input: [{ image: dataUri }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Jina] Buffer embedding error ${res.status}:`, text);
      return null;
    }

    const json = await res.json();
    const embedding: number[] = json.data?.[0]?.embedding;
    if (!embedding || embedding.length !== EMBEDDING_DIMS) {
      console.error("[Jina] Unexpected embedding shape:", embedding?.length);
      return null;
    }

    return embedding;
  } catch (err) {
    console.error("[Jina] getImageEmbeddingFromBuffer error:", err);
    return null;
  }
}

/**
 * Получить текстовый эмбеддинг через Jina API
 * Текст и картинки живут в одном пространстве (CLIP-подобная архитектура)
 * При 429 (rate limit) — автоматический retry с паузой
 */
export async function getTextEmbedding(
  text: string,
  maxRetries = 3
): Promise<number[] | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(JINA_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify({
          model: JINA_MODEL,
          dimensions: EMBEDDING_DIMS,
          normalized: true,
          input: [{ text }],
        }),
      });

      if (res.status === 429 && attempt < maxRetries) {
        const waitSec = Math.min(10 * (attempt + 1), 30);
        console.warn(`[Jina] Text rate limited, waiting ${waitSec}s (attempt ${attempt + 1}/${maxRetries})...`);
        await sleep(waitSec * 1000);
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[Jina] Text embedding error ${res.status}:`, errText);
        return null;
      }

      const json = await res.json();
      const embedding: number[] = json.data?.[0]?.embedding;
      if (!embedding || embedding.length !== EMBEDDING_DIMS) {
        console.error("[Jina] Unexpected embedding shape:", embedding?.length);
        return null;
      }

      return embedding;
    } catch (err) {
      console.error("[Jina] getTextEmbedding error:", err);
      return null;
    }
  }
  return null;
}

/**
 * Batch: получить эмбеддинги для нескольких изображений за один запрос
 * Jina поддерживает до 2048 элементов в batch
 */
export async function getImageEmbeddingsBatch(
  imageUrls: string[]
): Promise<(number[] | null)[]> {
  if (imageUrls.length === 0) return [];

  try {
    const res = await fetch(JINA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({
        model: JINA_MODEL,
        dimensions: EMBEDDING_DIMS,
        normalized: true,
        input: imageUrls.map((url) => ({ image: url })),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Jina] Batch embedding error ${res.status}:`, text);
      return imageUrls.map(() => null);
    }

    const json = await res.json();
    const data: { embedding: number[]; index: number }[] = json.data ?? [];

    // Jina возвращает результаты с index — сортируем по порядку
    const result: (number[] | null)[] = imageUrls.map(() => null);
    for (const item of data) {
      if (item.embedding?.length === EMBEDDING_DIMS) {
        result[item.index] = item.embedding;
      }
    }

    return result;
  } catch (err) {
    console.error("[Jina] getImageEmbeddingsBatch error:", err);
    return imageUrls.map(() => null);
  }
}

/** Размерность эмбеддингов Jina */
export const JINA_EMBEDDING_DIMS = EMBEDDING_DIMS;
