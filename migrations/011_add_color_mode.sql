-- Migration: Add color_mode to films table
-- Determines how colors are displayed for each video:
--   'dynamic' = animated color capsule (synced with video playback)
--   'static'  = 5 fixed colors (visually beautiful but stable palette)
--   'none'    = no colors shown (memes, screenshots, B&W, low quality)
-- Run this in Supabase SQL Editor

ALTER TABLE public.films
ADD COLUMN IF NOT EXISTS color_mode text DEFAULT 'dynamic'
CHECK (color_mode IN ('dynamic', 'static', 'none'));

COMMENT ON COLUMN public.films.color_mode IS 'Color display mode: dynamic (animated capsule), static (fixed 5 colors), none (no colors). Auto-detected via CLIP + deltaE analysis.';
