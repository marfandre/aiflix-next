-- Migration: Add private_prompt field to images_meta
-- Private prompt contains HEX-coded color instructions sent to fal.ai
-- Public prompt (existing "prompt" field) is shown to users

ALTER TABLE images_meta ADD COLUMN IF NOT EXISTS private_prompt text;

COMMENT ON COLUMN images_meta.private_prompt IS 'Private prompt with HEX color codes sent to image generation API';
