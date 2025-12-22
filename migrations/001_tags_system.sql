-- ============================================
-- TAGS SYSTEM MIGRATION
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Создать таблицу тегов
CREATE TABLE IF NOT EXISTS public.tags (
  id TEXT PRIMARY KEY,           -- 'cyberpunk', 'cozy', 'portrait'
  name_ru TEXT NOT NULL,         -- 'киберпанк'
  name_en TEXT NOT NULL,         -- 'cyberpunk'
  category TEXT NOT NULL,        -- 'genre' | 'mood' | 'scene'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Добавить поле tags[] в images_meta
ALTER TABLE public.images_meta 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 3. Удалить старые колонки (genres, mood, image_type)
ALTER TABLE public.images_meta DROP COLUMN IF EXISTS genres;
ALTER TABLE public.images_meta DROP COLUMN IF EXISTS mood;
ALTER TABLE public.images_meta DROP COLUMN IF EXISTS image_type;

-- 4. Индекс для быстрого поиска по тегам
CREATE INDEX IF NOT EXISTS idx_images_meta_tags ON public.images_meta USING GIN (tags);

-- 5. RLS политики для таблицы tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tags_read_all" ON public.tags;
CREATE POLICY "tags_read_all" ON public.tags FOR SELECT USING (true);

-- ============================================
-- GENRE TAGS (ЖАНРЫ)
-- ============================================
INSERT INTO public.tags (id, name_ru, name_en, category) VALUES
('sci_fi', 'научная фантастика', 'sci-fi', 'genre'),
('fantasy', 'фэнтези', 'fantasy', 'genre'),
('cyberpunk', 'киберпанк', 'cyberpunk', 'genre'),
('steampunk', 'стимпанк', 'steampunk', 'genre'),
('solarpunk', 'соларпанк', 'solarpunk', 'genre'),
('dieselpunk', 'дизельпанк', 'dieselpunk', 'genre'),
('post_apocalyptic', 'постапокалипсис', 'post-apocalyptic', 'genre'),
('dystopian', 'антиутопия', 'dystopian', 'genre'),
('utopian', 'утопия', 'utopian', 'genre'),
('horror', 'хоррор', 'horror', 'genre'),
('dark_fantasy', 'тёмное фэнтези', 'dark fantasy', 'genre'),
('space_opera', 'космоопера', 'space opera', 'genre'),
('noir', 'нуар', 'noir', 'genre'),
('western', 'вестерн', 'western', 'genre'),
('medieval', 'средневековый', 'medieval', 'genre'),
('historical', 'исторический', 'historical', 'genre'),
('mythological', 'мифологический', 'mythological', 'genre'),
('surrealism', 'сюрреализм', 'surrealism', 'genre'),
('abstract', 'абстракция', 'abstract', 'genre'),
('realism', 'реализм', 'realism', 'genre'),
('hyperrealism', 'гиперреализм', 'hyperrealism', 'genre'),
('minimalism', 'минимализм', 'minimalism', 'genre'),
('brutalism', 'брутализм', 'brutalism', 'genre'),
('gothic', 'готика', 'gothic', 'genre'),
('baroque', 'барокко', 'baroque', 'genre'),
('art_deco', 'арт-деко', 'art deco', 'genre'),
('retro', 'ретро', 'retro', 'genre'),
('vintage', 'винтаж', 'vintage', 'genre'),
('vaporwave', 'вейпорвейв', 'vaporwave', 'genre'),
('synthwave', 'синтвейв', 'synthwave', 'genre'),
('anime', 'аниме', 'anime', 'genre'),
('manga', 'манга', 'manga', 'genre'),
('comic', 'комикс', 'comic', 'genre'),
('illustration', 'иллюстрация', 'illustration', 'genre'),
('digital_art', 'цифровое искусство', 'digital art', 'genre'),
('concept_art', 'концепт-арт', 'concept art', 'genre'),
('concept_design', 'концептуальный дизайн', 'concept design', 'genre'),
('environment_art', 'окружение, мир', 'environment art', 'genre'),
('character_design', 'дизайн персонажа', 'character design', 'genre'),
('watercolor', 'акварель', 'watercolor', 'genre'),
('oil_painting', 'масляная живопись', 'oil painting', 'genre'),
('sketch', 'скетч', 'sketch', 'genre'),
('low_poly', 'low poly', 'low poly', 'genre'),
('pixel_art', 'пиксель-арт', 'pixel art', 'genre'),
('photorealistic', 'фотореализм', 'photorealistic', 'genre'),
('ai_art', 'AI-арт', 'AI art', 'genre'),
('cinematic', 'кинематографичный', 'cinematic', 'genre'),
('space_art', 'космическое искусство', 'space art', 'genre'),
('sci_fantasy', 'научное фэнтези', 'science fantasy', 'genre'),
('dark_sci_fi', 'тёмная фантастика', 'dark sci-fi', 'genre'),
('isometric', 'изометрия', 'isometric', 'genre'),
('3d_render', '3D рендер', '3D render', 'genre'),
('matte_painting', 'мэт-пейнтинг', 'matte painting', 'genre')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- MOOD TAGS (АТМОСФЕРА)
-- ============================================
INSERT INTO public.tags (id, name_ru, name_en, category) VALUES
('calm', 'спокойный', 'calm', 'mood'),
('peaceful', 'умиротворённый', 'peaceful', 'mood'),
('cozy', 'уютный', 'cozy', 'mood'),
('warm', 'тёплый', 'warm', 'mood'),
('cold', 'холодный', 'cold', 'mood'),
('dark', 'тёмный', 'dark', 'mood'),
('gloomy', 'мрачный', 'gloomy', 'mood'),
('eerie', 'жуткий', 'eerie', 'mood'),
('mysterious', 'загадочный', 'mysterious', 'mood'),
('dreamy', 'мечтательный', 'dreamy', 'mood'),
('epic', 'эпичный', 'epic', 'mood'),
('dramatic', 'драматичный', 'dramatic', 'mood'),
('melancholic', 'меланхоличный', 'melancholic', 'mood'),
('romantic', 'романтичный', 'romantic', 'mood'),
('nostalgic', 'ностальгический', 'nostalgic', 'mood'),
('magical', 'магический', 'magical', 'mood'),
('mystical', 'мистический', 'mystical', 'mood'),
('vibrant', 'насыщенный', 'vibrant', 'mood'),
('muted', 'приглушённый', 'muted', 'mood'),
('minimal', 'минималистичный', 'minimal', 'mood'),
('clean', 'чистый', 'clean', 'mood'),
('chaotic', 'хаотичный', 'chaotic', 'mood'),
('intense', 'напряжённый', 'intense', 'mood'),
('soft', 'мягкий', 'soft', 'mood'),
('moody', 'атмосферный', 'moody', 'mood'),
('quiet', 'тихий', 'quiet', 'mood'),
('lonely', 'одинокий', 'lonely', 'mood'),
('hopeful', 'обнадёживающий', 'hopeful', 'mood'),
('sad', 'грустный', 'sad', 'mood'),
('happy', 'радостный', 'happy', 'mood'),
('playful', 'игривый', 'playful', 'mood'),
('ominous', 'зловещий', 'ominous', 'mood'),
('brutal', 'жёсткий', 'brutal', 'mood'),
('elegant', 'элегантный', 'elegant', 'mood'),
('luxurious', 'роскошный', 'luxurious', 'mood'),
('apocalyptic', 'апокалиптичный', 'apocalyptic', 'mood'),
('ethereal', 'эфирный', 'ethereal', 'mood'),
('foggy', 'туманный', 'foggy', 'mood'),
('rainy', 'дождливый', 'rainy', 'mood'),
('stormy', 'штормовой', 'stormy', 'mood'),
('snowy', 'снежный', 'snowy', 'mood'),
('glowing', 'светящийся', 'glowing', 'mood'),
('neon', 'неоновый', 'neon', 'mood'),
('serene', 'безмятежный', 'serene', 'mood'),
('emotional', 'эмоциональный', 'emotional', 'mood'),
('poetic', 'поэтичный', 'poetic', 'mood'),
('cosmic', 'космический', 'cosmic', 'mood'),
('vast', 'ощущение масштаба', 'vast', 'mood'),
('isolated', 'изолированный', 'isolated', 'mood'),
('tranquil', 'спокойный, тихий', 'tranquil', 'mood'),
('awe', 'вызывающий трепет', 'awe', 'mood'),
('silent', 'безмолвный', 'silent', 'mood'),
('uncanny', 'тревожно-странный', 'uncanny', 'mood'),
('golden_hour', 'золотой час', 'golden hour', 'mood')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SCENE TAGS (СЦЕНА)
-- ============================================
INSERT INTO public.tags (id, name_ru, name_en, category) VALUES
('portrait', 'портрет', 'portrait', 'scene'),
('landscape', 'пейзаж', 'landscape', 'scene'),
('close_up', 'крупный план', 'close-up', 'scene'),
('wide_shot', 'общий план', 'wide shot', 'scene'),
('forest', 'лес', 'forest', 'scene'),
('jungle', 'джунгли', 'jungle', 'scene'),
('desert', 'пустыня', 'desert', 'scene'),
('mountains', 'горы', 'mountains', 'scene'),
('ocean', 'океан', 'ocean', 'scene'),
('sea', 'море', 'sea', 'scene'),
('beach', 'пляж', 'beach', 'scene'),
('island', 'остров', 'island', 'scene'),
('river', 'река', 'river', 'scene'),
('lake', 'озеро', 'lake', 'scene'),
('waterfall', 'водопад', 'waterfall', 'scene'),
('cave', 'пещера', 'cave', 'scene'),
('volcano', 'вулкан', 'volcano', 'scene'),
('sky', 'небо', 'sky', 'scene'),
('clouds', 'облака', 'clouds', 'scene'),
('sunset', 'закат', 'sunset', 'scene'),
('sunrise', 'рассвет', 'sunrise', 'scene'),
('night_sky', 'ночное небо', 'night sky', 'scene'),
('stars', 'звёзды', 'stars', 'scene'),
('galaxy', 'галактика', 'galaxy', 'scene'),
('planet', 'планета', 'planet', 'scene'),
('moon', 'луна', 'moon', 'scene'),
('outer_space', 'открытый космос', 'outer space', 'scene'),
('space_station', 'космическая станция', 'space station', 'scene'),
('alien_planet', 'инопланетная планета', 'alien planet', 'scene'),
('asteroid', 'астероид', 'asteroid', 'scene'),
('orbit', 'орбита', 'orbit', 'scene'),
('city', 'город', 'city', 'scene'),
('cityscape', 'городской пейзаж', 'cityscape', 'scene'),
('street', 'улица', 'street', 'scene'),
('road', 'дорога', 'road', 'scene'),
('bridge', 'мост', 'bridge', 'scene'),
('skyscraper', 'небоскрёб', 'skyscraper', 'scene'),
('building', 'здание', 'building', 'scene'),
('house', 'дом', 'house', 'scene'),
('village', 'деревня', 'village', 'scene'),
('ruins', 'руины', 'ruins', 'scene'),
('abandoned_city', 'заброшенный город', 'abandoned city', 'scene'),
('futuristic_city', 'город будущего', 'futuristic city', 'scene'),
('room', 'комната', 'room', 'scene'),
('corridor', 'коридор', 'corridor', 'scene'),
('library', 'библиотека', 'library', 'scene'),
('laboratory', 'лаборатория', 'laboratory', 'scene'),
('temple', 'храм', 'temple', 'scene'),
('castle', 'замок', 'castle', 'scene'),
('palace', 'дворец', 'palace', 'scene'),
('human', 'человек', 'human', 'scene'),
('silhouette', 'силуэт', 'silhouette', 'scene'),
('astronaut', 'астронавт', 'astronaut', 'scene'),
('robot', 'робот', 'robot', 'scene'),
('android', 'андроид', 'android', 'scene'),
('cyborg', 'киборг', 'cyborg', 'scene'),
('alien', 'инопланетянин', 'alien', 'scene'),
('creature', 'существо', 'creature', 'scene'),
('dragon', 'дракон', 'dragon', 'scene'),
('angel', 'ангел', 'angel', 'scene'),
('demon', 'демон', 'demon', 'scene'),
('fire', 'огонь', 'fire', 'scene'),
('smoke', 'дым', 'smoke', 'scene'),
('fog', 'туман', 'fog', 'scene'),
('portal', 'портал', 'portal', 'scene'),
('spaceship', 'космический корабль', 'spaceship', 'scene'),
('spaceship_interior', 'интерьер корабля', 'spaceship interior', 'scene'),
('vehicle', 'транспорт', 'vehicle', 'scene'),
('car', 'автомобиль', 'car', 'scene'),
('train', 'поезд', 'train', 'scene'),
('ship', 'корабль', 'ship', 'scene'),
('tower', 'башня', 'tower', 'scene'),
('monument', 'монумент', 'monument', 'scene'),
('interior', 'интерьер', 'interior', 'scene'),
('aerial_view', 'вид сверху', 'aerial view', 'scene'),
('underwater', 'под водой', 'underwater', 'scene'),
('floating_islands', 'парящие острова', 'floating islands', 'scene'),
('mech', 'мех', 'mech', 'scene'),
('weapon', 'оружие', 'weapon', 'scene')
ON CONFLICT (id) DO NOTHING;
