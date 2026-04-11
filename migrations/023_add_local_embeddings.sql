-- migrations/023_add_local_embeddings.sql
-- Локальные эмбеддинги Jina CLIP v1 (768 dims), запускаемые через @huggingface/transformers.
-- Voyage (1024) и Jina remote (1024) колонки не трогаем — остаются для отката.

-- 1. Колонки
ALTER TABLE images_meta
ADD COLUMN IF NOT EXISTS embedding_local vector(768);

ALTER TABLE films
ADD COLUMN IF NOT EXISTS embedding_local vector(768);

-- 2. Индексы ivfflat cosine
CREATE INDEX IF NOT EXISTS idx_images_meta_embedding_local
ON images_meta USING ivfflat (embedding_local vector_cosine_ops) WITH (lists = 10);

CREATE INDEX IF NOT EXISTS idx_films_embedding_local
ON films USING ivfflat (embedding_local vector_cosine_ops) WITH (lists = 10);

-- 3. RPC семантического поиска
CREATE OR REPLACE FUNCTION search_by_embedding_local(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.2,
  match_count int DEFAULT 30,
  search_type text DEFAULT 'all'
)
RETURNS TABLE (
  id uuid,
  media_type text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY

  SELECT
    im.id,
    'image'::text as media_type,
    1 - (im.embedding_local <=> query_embedding) as similarity
  FROM images_meta im
  WHERE im.embedding_local IS NOT NULL
    AND (search_type = 'all' OR search_type = 'images')
    AND 1 - (im.embedding_local <=> query_embedding) > match_threshold

  UNION ALL

  SELECT
    f.id,
    'video'::text as media_type,
    1 - (f.embedding_local <=> query_embedding) as similarity
  FROM films f
  WHERE f.embedding_local IS NOT NULL
    AND (search_type = 'all' OR search_type = 'videos')
    AND 1 - (f.embedding_local <=> query_embedding) > match_threshold

  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

COMMENT ON COLUMN images_meta.embedding_local IS 'Jina CLIP v1 (768 dims) local inference via @huggingface/transformers';
COMMENT ON COLUMN films.embedding_local IS 'Jina CLIP v1 (768 dims) local inference via @huggingface/transformers';
