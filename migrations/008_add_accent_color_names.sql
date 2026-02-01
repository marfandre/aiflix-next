-- Миграция: добавление поля accent_color_names
-- NTC названия для акцентных цветов

-- Добавляем поле accent_color_names в images_meta
ALTER TABLE images_meta 
ADD COLUMN IF NOT EXISTS accent_color_names TEXT[] DEFAULT '{}';

-- Добавляем поле accent_color_names в films (для видео)
ALTER TABLE films 
ADD COLUMN IF NOT EXISTS accent_color_names TEXT[] DEFAULT '{}';

-- COMMENT: 
-- accent_color_names содержит NTC названия для акцентных цветов
-- Например: ['Electric Blue', 'Neon Carrot'] для ярких акцентов
