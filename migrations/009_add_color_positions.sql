-- 009_add_color_positions.sql
-- Добавляет поле для хранения координат цветов на изображении

-- Для images_meta (картинки)
ALTER TABLE images_meta
ADD COLUMN IF NOT EXISTS color_positions jsonb DEFAULT NULL;

COMMENT ON COLUMN images_meta.color_positions IS 'Координаты цветов на изображении в формате [{hex, x, y}, ...]';

-- Для films (видео) - если понадобится в будущем
-- ALTER TABLE films
-- ADD COLUMN IF NOT EXISTS color_positions jsonb DEFAULT NULL;
