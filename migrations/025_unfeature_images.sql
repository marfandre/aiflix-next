-- migrations/025_unfeature_images.sql
-- Правка витрины: убираем 20 картинок и добираем 2 новых.

UPDATE images_meta SET is_featured = false WHERE id IN (
  '79f5fd86-1aa8-4e45-b976-218751c44fc8',
  '622d99bb-b31e-4e89-8d00-b88a9f2607f9',
  '9198c8eb-1a92-47f0-b1da-2c399fc0784b',
  '4c96e70c-b784-4a6e-804a-aa49e5219307',
  '2f32464e-a825-47a8-98cb-eb2d1ac14981',
  '71c1a147-44a1-497b-bea3-6e89e1f11054',
  'e3d1034d-1a71-4b59-8ceb-5f2e1fe4b29a',
  'df2245d6-ae5c-4f8b-8f86-b02134a28862',
  'e595da23-26d4-4bc7-9c8e-5f73160a68e3',
  'dcd9bcff-08c4-4334-9ffb-7462a982774a',
  '18b27a9d-ba3a-4425-9f9d-fc0be869b2ca',
  '95be77dc-3c43-437f-9254-a9a2424f8222',
  '954333fe-f526-47cd-bbdd-5c269e842539',
  '9d4925be-aab6-45dc-a28d-3cac3de1f45e',
  'b0db54e8-0e11-4234-8e02-954964430272',
  '5460dda7-8932-4b02-b541-87d8e254a916',
  '38189b7f-2f94-4314-a841-5e968e81ff39',
  'bd64824e-1491-423b-9cd6-6ed9449426ef',
  'e0f0d9a5-9dbb-4cf2-81c7-2023ffab9512',
  '3abab69c-7ae8-45c7-8bbe-f0cf8d45ab92'
);

UPDATE images_meta SET is_featured = true WHERE id IN (
  '18162d17-98b8-45d3-807b-f4201c1796d7',
  '64465b46-d4a4-4427-9087-aa44fea9dade'
);
