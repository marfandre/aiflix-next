-- Seed генерации
ALTER TABLE images_meta ADD COLUMN IF NOT EXISTS seed text;
ALTER TABLE films ADD COLUMN IF NOT EXISTS seed text;

-- Источник импорта (платформа, автор, ссылка)
ALTER TABLE images_meta ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE images_meta ADD COLUMN IF NOT EXISTS source_author text;
ALTER TABLE images_meta ADD COLUMN IF NOT EXISTS source_url text;

ALTER TABLE films ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE films ADD COLUMN IF NOT EXISTS source_author text;
ALTER TABLE films ADD COLUMN IF NOT EXISTS source_url text;
