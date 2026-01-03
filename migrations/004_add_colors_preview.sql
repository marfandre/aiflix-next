-- Migration: Add colors_preview field to films table for hover animation
-- Run this in Supabase SQL Editor

ALTER TABLE public.films 
ADD COLUMN IF NOT EXISTS colors_preview text[];

-- Comment for documentation
COMMENT ON COLUMN public.films.colors_preview IS 'Array of 15 HEX colors from first 5 seconds (5 frames × 3 colors: bg, secondary, accent) for hover animation';
