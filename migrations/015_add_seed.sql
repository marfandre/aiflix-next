-- Добавляем поле seed для хранения seed генерации
ALTER TABLE images_meta ADD COLUMN IF NOT EXISTS seed text;
ALTER TABLE films ADD COLUMN IF NOT EXISTS seed text;
