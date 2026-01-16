-- Миграция: добавление акцентных цветов
-- Акцентные цвета - яркие цвета, занимающие малую площадь, но создающие атмосферу

-- Добавляем поле accent_colors в images_meta
ALTER TABLE images_meta 
ADD COLUMN IF NOT EXISTS accent_colors TEXT[] DEFAULT '{}';

-- Добавляем поле accent_colors в films (для видео)
ALTER TABLE films 
ADD COLUMN IF NOT EXISTS accent_colors TEXT[] DEFAULT '{}';

-- Индексы для поиска по акцентным цветам
CREATE INDEX IF NOT EXISTS idx_images_meta_accent_colors ON images_meta USING GIN (accent_colors);
CREATE INDEX IF NOT EXISTS idx_films_accent_colors ON films USING GIN (accent_colors);

-- COMMENT: 
-- accent_colors содержит до 3 ярких HEX-цветов, которые:
-- 1. Имеют высокую насыщенность (S > 50%)
-- 2. Занимают малую площадь (<10% изображения)
-- Примеры: неоновые огни, свечение солнца, яркие акценты на тёмном фоне
