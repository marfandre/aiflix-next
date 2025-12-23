-- Migration: Add prompt field to films table
-- Run this in Supabase SQL Editor

ALTER TABLE public.films 
ADD COLUMN IF NOT EXISTS prompt text;

-- Optional: Add model field if it doesn't exist
ALTER TABLE public.films 
ADD COLUMN IF NOT EXISTS model text;

-- Optional: Add mood field if it doesn't exist  
ALTER TABLE public.films 
ADD COLUMN IF NOT EXISTS mood text;

-- Comment for documentation
COMMENT ON COLUMN public.films.prompt IS 'AI prompt used to generate the video';
