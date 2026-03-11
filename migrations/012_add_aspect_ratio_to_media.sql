-- Миграция: Добавление соотношения сторон (aspect_ratio) для медиафайлов
-- Это позволит нам красиво выводить [ 16:9 ] или [ 9:16 ] в левой карточке

-- 1. Добавляем колонку в таблицу видеофайлов
ALTER TABLE films
ADD COLUMN IF NOT EXISTS aspect_ratio VARCHAR(20) DEFAULT NULL;

-- 2. Добавляем колонку в таблицу изображений
ALTER TABLE images_meta
ADD COLUMN IF NOT EXISTS aspect_ratio VARCHAR(20) DEFAULT NULL;
