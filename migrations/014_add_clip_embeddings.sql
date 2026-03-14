-- migrations/014_add_clip_embeddings.sql
-- Семантический поиск через CLIP embeddings + pgvector

-- 1. Включаем расширение pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Добавляем колонку embedding в images_meta
ALTER TABLE images_meta
ADD COLUMN IF NOT EXISTS embedding vector(512);

-- 3. Добавляем колонку embedding в films
ALTER TABLE films
ADD COLUMN IF NOT EXISTS embedding vector(512);

-- 4. Индексы для быстрого поиска по cosine similarity
-- ivfflat — хороший баланс скорости и точности для небольших наборов данных
-- При росте до 100k+ записей можно пересоздать с lists = sqrt(N)
CREATE INDEX IF NOT EXISTS idx_images_meta_embedding
ON images_meta USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

CREATE INDEX IF NOT EXISTS idx_films_embedding
ON films USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- 5. Функция для семантического поиска (используется из API)
CREATE OR REPLACE FUNCTION search_by_embedding(
  query_embedding vector(512),
  match_threshold float DEFAULT 0.25,
  match_count int DEFAULT 20,
  search_type text DEFAULT 'all' -- 'all', 'images', 'videos'
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

  -- Images
  SELECT
    im.id,
    'image'::text as media_type,
    1 - (im.embedding <=> query_embedding) as similarity
  FROM images_meta im
  WHERE im.embedding IS NOT NULL
    AND (search_type = 'all' OR search_type = 'images')
    AND 1 - (im.embedding <=> query_embedding) > match_threshold

  UNION ALL

  -- Videos
  SELECT
    f.id,
    'video'::text as media_type,
    1 - (f.embedding <=> query_embedding) as similarity
  FROM films f
  WHERE f.embedding IS NOT NULL
    AND (search_type = 'all' OR search_type = 'videos')
    AND 1 - (f.embedding <=> query_embedding) > match_threshold

  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- COMMENT
COMMENT ON COLUMN images_meta.embedding IS 'CLIP ViT-B/32 embedding (512 dims) for semantic search';
COMMENT ON COLUMN films.embedding IS 'CLIP ViT-B/32 embedding (512 dims) for semantic search';
