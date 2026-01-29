-- migrations/007_add_color_weights.sql
-- Добавляем колонку для хранения весов цветов (процент площади)

ALTER TABLE images_meta ADD COLUMN IF NOT EXISTS color_weights real[];

-- Индекс не нужен — это не поле для поиска, только для сортировки
