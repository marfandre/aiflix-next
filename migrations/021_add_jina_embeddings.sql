-- migrations/021_add_jina_embeddings.sql
-- Переход с CLIP (512 dims) на Jina Embeddings v3 (1024 dims)

-- 1. Удаляем старые CLIP-индексы и колонки
DROP INDEX IF EXISTS idx_images_meta_embedding;
DROP INDEX IF EXISTS idx_films_embedding;

ALTER TABLE images_meta DROP COLUMN IF EXISTS embedding;
ALTER TABLE films DROP COLUMN IF EXISTS embedding;

-- 2. Удаляем старую функцию поиска
DROP FUNCTION IF EXISTS search_by_embedding;

-- 3. Добавляем новые колонки для Jina (1024 dims)
ALTER TABLE images_meta
ADD COLUMN IF NOT EXISTS embedding_jina vector(1024);

ALTER TABLE films
ADD COLUMN IF NOT EXISTS embedding_jina vector(1024);

-- 4. Индексы для cosine similarity (ivfflat)
-- При росте до 100k+ записей пересоздать с lists = sqrt(N)
CREATE INDEX IF NOT EXISTS idx_images_meta_embedding_jina
ON images_meta USING ivfflat (embedding_jina vector_cosine_ops) WITH (lists = 10);

CREATE INDEX IF NOT EXISTS idx_films_embedding_jina
ON films USING ivfflat (embedding_jina vector_cosine_ops) WITH (lists = 10);

-- 5. Функция семантического поиска (Jina, 1024 dims)
CREATE OR REPLACE FUNCTION search_by_embedding_jina(
  query_embedding vector(1024),
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
    1 - (im.embedding_jina <=> query_embedding) as similarity
  FROM images_meta im
  WHERE im.embedding_jina IS NOT NULL
    AND (search_type = 'all' OR search_type = 'images')
    AND 1 - (im.embedding_jina <=> query_embedding) > match_threshold

  UNION ALL

  -- Videos
  SELECT
    f.id,
    'video'::text as media_type,
    1 - (f.embedding_jina <=> query_embedding) as similarity
  FROM films f
  WHERE f.embedding_jina IS NOT NULL
    AND (search_type = 'all' OR search_type = 'videos')
    AND 1 - (f.embedding_jina <=> query_embedding) > match_threshold

  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- 6. Комментарии
COMMENT ON COLUMN images_meta.embedding_jina IS 'Jina Embeddings v3 (1024 dims) for semantic search';
COMMENT ON COLUMN films.embedding_jina IS 'Jina Embeddings v3 (1024 dims) for semantic search';
