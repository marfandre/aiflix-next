-- migrations/024_add_featured_images.sql
-- Витрина: ручная курация главной ленты картинок.
-- На главной (нет фильтров, не на странице профиля) показываем только is_featured=true.
-- В профилях, поиске и при активных фильтрах флаг игнорируется.

-- 1. Колонка
ALTER TABLE images_meta
ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- 2. Частичный индекс — быстрая выдача витрины
CREATE INDEX IF NOT EXISTS idx_images_meta_is_featured
ON images_meta (created_at DESC)
WHERE is_featured = true;

-- 3. Первичный набор витрины (84 уникальных id)
UPDATE images_meta SET is_featured = true WHERE id IN (
  'e9436f6c-ea7a-4e3f-a8f5-dba1ae279c36',
  '9cbeda15-59f7-41d9-911d-d25f9e3287fe',
  '018527c9-cf15-400a-a82e-2e4a21389c9e',
  '8cd225aa-6778-407d-b4b1-8bb172d3f6c3',
  '05b13c02-9660-448b-83c1-2fdd0fb3df91',
  '2258972e-e6ef-4dee-a995-2817c1a0fae8',
  '66861795-a292-4992-8690-1b392ac6cf0c',
  'f939d97a-c9ef-49c2-9f2b-68ff617d32ed',
  'aaa4ec41-a1ff-42dc-b4d1-a70635dce4ca',
  '40b2d484-9f0b-41e9-bec7-b60b143616a0',
  '22454cf2-0c19-401b-bb27-880e3377ff50',
  '4b690fc5-2faa-42cb-a015-71477461f47a',
  'dd03d932-4ee0-4bff-9f63-5fbb6b6083d4',
  '782b9c5a-59c5-4e31-adb3-2919ba2c633c',
  '2901b898-1485-48a9-a3aa-93c45aaf8d57',
  'a48aab2f-fe6a-4d41-b5b3-d3f9aa65b426',
  'c61a29c1-7545-402a-8fd5-724d8cb5b52b',
  '6b267edf-f673-4d05-9c0a-e233fd01fb86',
  'b3c06ce1-7cf0-44b3-bf16-915926296370',
  '55c48e2c-8885-412d-b526-1b582a7c2520',
  '52d19c18-1330-409b-8fca-c61b7514af5e',
  '89f0b811-db5b-4acf-a8b1-74b7157cff5b',
  '79f5fd86-1aa8-4e45-b976-218751c44fc8',
  '0b4a3dd2-c479-43cf-ac37-a283becc3f89',
  '007422bc-8c6f-460c-a687-5513bc498c0d',
  '56126d5e-ced6-48a6-aaf0-0a58505017b3',
  '80a0d231-625e-48a5-9f76-63a06e3abfdc',
  'f4f2aa81-9ed0-4f8a-a9c6-2ddc77f1f963',
  '28012d5a-4afd-4ad5-9ed7-7dc822fa6b1c',
  '2a24ba93-16f3-41e8-a1cc-f4b259a9d2ab',
  '61739b50-d614-4e6b-a630-fce2dea0d622',
  'a2c7e431-6f73-4043-a36d-2a70481edcda',
  '3ed40ec6-8cd8-4f34-a13a-7d15534c5011',
  'dbe17013-7902-499b-abac-e757f37de274',
  'e0f0d9a5-9dbb-4cf2-81c7-2023ffab9512',
  '7327e5c1-204b-4fc7-94ed-931303ae0b7a',
  '622d99bb-b31e-4e89-8d00-b88a9f2607f9',
  '3abab69c-7ae8-45c7-8bbe-f0cf8d45ab92',
  'ea7016f1-110d-4af0-a89f-1b4b59067dda',
  '0ea028a9-2b09-428d-a765-a3ef086b7ef3',
  '6ab584f0-a2fe-4ecc-ba05-5295795da608',
  '5217ce59-e350-46af-b51a-f00072002e05',
  'be409ba6-d188-4894-a6e6-6ae85b745cc3',
  '69869be1-8817-4e5d-925e-3572ff040958',
  'def5fda1-a8b3-490e-8195-f95d7ae1e55e',
  '5460dda7-8932-4b02-b541-87d8e254a916',
  '9198c8eb-1a92-47f0-b1da-2c399fc0784b',
  '38189b7f-2f94-4314-a841-5e968e81ff39',
  '2f32464e-a825-47a8-98cb-eb2d1ac14981',
  '2b87b710-622e-47b6-9404-3e6ed7d0eabc',
  '3d7a92ab-cf3d-4648-9a61-f95d99aeede8',
  'b5edf0ce-e4b0-491c-873a-5a73ded6c70e',
  'bd64824e-1491-423b-9cd6-6ed9449426ef',
  'aebb77ba-6137-4f59-ba29-e5d287f10a10',
  '954333fe-f526-47cd-bbdd-5c269e842539',
  'f7c98c11-68e8-442e-a83f-d0e3023a75ea',
  '4619e585-f089-4dfb-b0f3-8a6f4f07c946',
  '46ce66dd-4bb8-4d3a-8073-4e2427eb72f6',
  '9d4925be-aab6-45dc-a28d-3cac3de1f45e',
  '4c96e70c-b784-4a6e-804a-aa49e5219307',
  '6a3f684f-23fe-42e8-8300-d8796af4cd9e',
  '27e00f74-0120-4877-a58c-0b7ffbd8ab1f',
  '805da701-31b3-4675-97c6-e1c6c8261aad',
  'df2245d6-ae5c-4f8b-8f86-b02134a28862',
  'b0db54e8-0e11-4234-8e02-954964430272',
  '66b486fe-ae37-4789-af40-2e7d719b963d',
  '71c1a147-44a1-497b-bea3-6e89e1f11054',
  'e3d1034d-1a71-4b59-8ceb-5f2e1fe4b29a',
  '70d0c262-b8d5-4196-9a1f-ae5f5b19ce31',
  'bd0b0783-8b6d-4806-af5c-77897cac9b6d',
  'fdaf4ef7-a029-4ae5-9329-86314d2d7d89',
  'd399425f-1816-4d56-948c-cdec85139699',
  'd41e91dd-d5a7-4332-8290-e72e55067fc6',
  'a070b32c-4909-4982-8f9c-c4dcf8c9abe6',
  '7c098417-8873-4e5f-8f6c-dce50d09eab6',
  '95be77dc-3c43-437f-9254-a9a2424f8222',
  '18b27a9d-ba3a-4425-9f9d-fc0be869b2ca',
  'a50a68bd-c428-4664-9d0c-22d7ba667496',
  '493409f1-5fc6-4ff9-88b8-d8613f3c0fd9',
  'e595da23-26d4-4bc7-9c8e-5f73160a68e3',
  'dcd9bcff-08c4-4334-9ffb-7462a982774a',
  'f3dbfca3-3897-4bdc-802a-f2c68ee1de8f',
  '27a738b3-0801-4aef-8cdb-e0bd64da0fac',
  'a9576678-b02a-4a90-9715-6078d10de20e'
);

COMMENT ON COLUMN images_meta.is_featured IS 'Витрина главной: курируемая лента без фильтров. Profile и фильтры/поиск этот флаг игнорируют.';
