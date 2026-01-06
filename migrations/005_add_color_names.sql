-- Миграция: добавление поля color_names для хранения NTC названий цветов
-- Это поле будет использоваться для точного поиска по категориям цветов

-- Добавляем поле color_names в images_meta
ALTER TABLE images_meta 
ADD COLUMN IF NOT EXISTS color_names TEXT[] DEFAULT '{}';

-- Добавляем поле color_names в films (для видео)
ALTER TABLE films 
ADD COLUMN IF NOT EXISTS color_names TEXT[] DEFAULT '{}';

-- Создаём GIN индекс для быстрого полнотекстового поиска по массиву
CREATE INDEX IF NOT EXISTS idx_images_meta_color_names ON images_meta USING GIN (color_names);
CREATE INDEX IF NOT EXISTS idx_films_color_names ON films USING GIN (color_names);

-- COMMENT: 
-- color_names содержит NTC (Name That Color) названия для каждого цвета в палитре
-- Например: ['Caramel', 'California', 'Gold'] для картинки с персиковыми и оранжевыми оттенками
-- Это позволяет делать точный поиск: 'Caramel' != 'Cameo', даже если HEX-коды близки
