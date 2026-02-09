-- Migration: Add colors_full and colors_full_interval to films table
-- For full-video color capsule synced with playback time
-- Run this in Supabase SQL Editor

ALTER TABLE public.films
ADD COLUMN IF NOT EXISTS colors_full text[];

ALTER TABLE public.films
ADD COLUMN IF NOT EXISTS colors_full_interval smallint DEFAULT 1;

COMMENT ON COLUMN public.films.colors_full IS 'Full video color array: 3 HEX colors per frame, max 60 frames. Used for modal capsule synced with video playback.';
COMMENT ON COLUMN public.films.colors_full_interval IS 'Interval in seconds between color frames in colors_full. E.g. 1 = every second, 2 = every 2 seconds.';
