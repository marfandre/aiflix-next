-- Миграция: пользовательские сохранения (промты + палитры цветов)
-- Приватные для владельца, доступ через RLS.

-- =========================
-- Сохранённые промты
-- =========================
CREATE TABLE IF NOT EXISTS public.saved_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  negative_prompt text,
  model text,
  seed text,
  aspect_ratio varchar(20),
  params jsonb,                  -- запас под будущие параметры (steps, cfg, sampler, lora и т.п.)
  source_type text CHECK (source_type IN ('film','image')),
  source_id uuid,                -- ссылка на films.id или images_meta.id (без FK — полиморфно)
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_prompts_user_created
  ON public.saved_prompts (user_id, created_at DESC);

ALTER TABLE public.saved_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_prompts_owner_all" ON public.saved_prompts;
CREATE POLICY "saved_prompts_owner_all" ON public.saved_prompts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =========================
-- Сохранённые палитры (1..N цветов в одной записи)
-- =========================
CREATE TABLE IF NOT EXISTS public.saved_palettes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  colors text[] NOT NULL CHECK (array_length(colors, 1) BETWEEN 1 AND 10),
  title text,
  source_type text CHECK (source_type IN ('film','image')),
  source_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_palettes_user_created
  ON public.saved_palettes (user_id, created_at DESC);

ALTER TABLE public.saved_palettes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_palettes_owner_all" ON public.saved_palettes;
CREATE POLICY "saved_palettes_owner_all" ON public.saved_palettes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
