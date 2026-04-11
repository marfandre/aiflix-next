-- migrations/022_add_voyage_embeddings.sql
-- Новая колонка для Voyage AI multimodal-3.5 эмбеддингов (1024 dims)
-- Jina-колонка (embedding_jina) сохраняется как есть — на случай отката.

-- 1. Новые колонки для Voyage (1024 dims, совпадает с Jina)
ALTER TABLE images_meta
ADD COLUMN IF NOT EXISTS embedding_voyage vector(1024);

ALTER TABLE films
ADD COLUMN IF NOT EXISTS embedding_voyage vector(1024);

-- 2. Индексы cosine similarity (ivfflat).
-- При росте до 100k+ записей пересоздать с lists = sqrt(N).
CREATE INDEX IF NOT EXISTS idx_images_meta_embedding_voyage
ON images_meta USING ivfflat (embedding_voyage vector_cosine_ops) WITH (lists = 10);

CREATE INDEX IF NOT EXISTS idx_films_embedding_voyage
ON films USING ivfflat (embedding_voyage vector_cosine_ops) WITH (lists = 10);

-- 3. Функция семантического поиска по Voyage
CREATE OR REPLACE FUNCTION search_by_embedding_voyage(
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

  SELECT
    im.id,
    'image'::text as media_type,
    1 - (im.embedding_voyage <=> query_embedding) as similarity
  FROM images_meta im
  WHERE im.embedding_voyage IS NOT NULL
    AND (search_type = 'all' OR search_type = 'images')
    AND 1 - (im.embedding_voyage <=> query_embedding) > match_threshold

  UNION ALL

  SELECT
    f.id,
    'video'::text as media_type,
    1 - (f.embedding_voyage <=> query_embedding) as similarity
  FROM films f
  WHERE f.embedding_voyage IS NOT NULL
    AND (search_type = 'all' OR search_type = 'videos')
    AND 1 - (f.embedding_voyage <=> query_embedding) > match_threshold

  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

COMMENT ON COLUMN images_meta.embedding_voyage IS 'Voyage AI multimodal-3.5 (1024 dims) for semantic search';
COMMENT ON COLUMN films.embedding_voyage IS 'Voyage AI multimodal-3.5 (1024 dims) for semantic search';
