-- migrations/026_add_featured_priority.sql
-- Приоритет внутри витрины: картинки с featured_priority > 0 всегда показываются
-- в верхней части ленты (с разрежением, чтобы одинаковые цвета не стояли рядом).

ALTER TABLE images_meta
ADD COLUMN IF NOT EXISTS featured_priority int NOT NULL DEFAULT 0;

UPDATE images_meta SET featured_priority = 1 WHERE id IN (
  '9cbeda15-59f7-41d9-911d-d25f9e3287fe',
  '05b13c02-9660-448b-83c1-2fdd0fb3df91',
  'b3c06ce1-7cf0-44b3-bf16-915926296370',
  'f939d97a-c9ef-49c2-9f2b-68ff617d32ed',
  '66861795-a292-4992-8690-1b392ac6cf0c',
  'dd03d932-4ee0-4bff-9f63-5fbb6b6083d4'
);

COMMENT ON COLUMN images_meta.featured_priority IS 'Приоритет в витрине (0 = обычный, >0 = поднимается наверх ленты и рассеивается между обычными)';
