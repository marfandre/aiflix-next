-- migrations/018_add_color_family_weights.sql
-- Probabilistic color family classification.
-- For each color in `colors`, store an object of the top-N family probabilities,
-- e.g. [{ "pink": 0.58, "red": 0.19, "purple": 0.17, "orange": 0.06 }, ...]
--
-- Replaces the bucket-style `color_families` for ranking purposes (the old
-- column is kept for backward compatibility / top-1 lookups).

ALTER TABLE images_meta ADD COLUMN IF NOT EXISTS color_family_weights jsonb;

ALTER TABLE films ADD COLUMN IF NOT EXISTS color_family_weights jsonb;
