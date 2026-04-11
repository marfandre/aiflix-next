// lib/localEmbeddingStub.ts
// Заглушка вместо lib/localEmbedding.ts для production-сборок (Vercel и т.п.),
// где мы НЕ хотим тянуть @huggingface/transformers (~150MB) в лямбду.
// Подключается через webpack alias в next.config.mjs, когда
// NEXT_PUBLIC_ENABLE_SEMANTIC_SEARCH !== '1'.
//
// Все функции возвращают null — вызывающий код в mux/webhook и images/complete
// проверяет результат и просто пропускает запись эмбеддинга.

export const LOCAL_EMBEDDING_DIMS = 768;

export async function getTextEmbedding(_text: string): Promise<number[] | null> {
  return null;
}

export async function getImageEmbeddingFromBuffer(
  _buffer: Buffer
): Promise<number[] | null> {
  return null;
}

export async function getImageEmbedding(_imageUrl: string): Promise<number[] | null> {
  return null;
}
