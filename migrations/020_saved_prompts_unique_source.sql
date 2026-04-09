-- Миграция: дедуп сохранённых промтов по источнику + уникальный индекс.
-- Один пользователь может сохранить промт из одной картинки/фильма только один раз.

-- 1. Удаляем существующие дубли, оставляя самую старую запись.
DELETE FROM public.saved_prompts
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, source_type, source_id
             ORDER BY created_at ASC, id ASC
           ) AS rn
    FROM public.saved_prompts
    WHERE source_id IS NOT NULL
  ) t
  WHERE t.rn > 1
);

-- 2. Уникальный индекс только для записей с источником.
-- Записи, сохранённые вручную без source_id, под ограничение не попадают.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_saved_prompts_user_source
  ON public.saved_prompts (user_id, source_type, source_id)
  WHERE source_id IS NOT NULL;
