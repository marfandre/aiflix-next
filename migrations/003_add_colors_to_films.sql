-- Migration: Add colors field to films table
-- Run this in Supabase SQL Editor

ALTER TABLE public.films 
ADD COLUMN IF NOT EXISTS colors text[];

-- Comment for documentation
COMMENT ON COLUMN public.films.colors IS 'Array of HEX color strings extracted from video thumbnail';
