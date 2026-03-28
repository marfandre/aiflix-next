-- Migration: Add new tags (genre, mood, scene)
-- ~95 new tags: styles, moods, animals, architecture, materials, lighting, characters

-- ============================================
-- GENRE TAGS (ЖАНРЫ / СТИЛИ)
-- ============================================
INSERT INTO public.tags (id, name_ru, name_en, category) VALUES
('art_nouveau', 'ар-нуво', 'art nouveau', 'genre'),
('pop_art', 'поп-арт', 'pop art', 'genre'),
('impressionism', 'импрессионизм', 'impressionism', 'genre'),
('expressionism', 'экспрессионизм', 'expressionism', 'genre'),
('ukiyo_e', 'укиё-э', 'ukiyo-e', 'genre'),
('graffiti', 'граффити', 'graffiti', 'genre'),
('collage', 'коллаж', 'collage', 'genre'),
('biopunk', 'биопанк', 'biopunk', 'genre'),
('atompunk', 'атомпанк', 'atompunk', 'genre'),
('cottagecore', 'коттеджкор', 'cottagecore', 'genre'),
('dark_academia', 'тёмная академия', 'dark academia', 'genre'),
('dreamcore', 'дримкор', 'dreamcore', 'genre'),
('liminal', 'лиминальные пространства', 'liminal spaces', 'genre'),
('afrofuturism', 'афрофутуризм', 'afrofuturism', 'genre'),
('art_brut', 'ар-брют', 'art brut', 'genre'),
('psychedelic', 'психоделика', 'psychedelic', 'genre'),
('glitch_art', 'глитч-арт', 'glitch art', 'genre'),
('macro_photo', 'макросъёмка', 'macro photography', 'genre'),
('long_exposure', 'длинная выдержка', 'long exposure', 'genre'),
('tilt_shift', 'тилт-шифт', 'tilt-shift', 'genre')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- MOOD TAGS (АТМОСФЕРА)
-- ============================================
INSERT INTO public.tags (id, name_ru, name_en, category) VALUES
('futuristic', 'футуристичный', 'futuristic', 'mood'),
('sacred', 'сакральный', 'sacred', 'mood'),
('whimsical', 'причудливый', 'whimsical', 'mood'),
('meditative', 'медитативный', 'meditative', 'mood'),
('aggressive', 'агрессивный', 'aggressive', 'mood'),
('delicate', 'нежный', 'delicate', 'mood'),
('heavy', 'тяжёлый', 'heavy', 'mood'),
('ancient', 'древний', 'ancient', 'mood'),
('festive', 'праздничный', 'festive', 'mood'),
('haunting', 'преследующий', 'haunting', 'mood')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SCENE TAGS (СЦЕНА)
-- ============================================

-- Природа / животные
INSERT INTO public.tags (id, name_ru, name_en, category) VALUES
('animal', 'животное', 'animal', 'scene'),
('cat', 'кот', 'cat', 'scene'),
('dog', 'собака', 'dog', 'scene'),
('wolf', 'волк', 'wolf', 'scene'),
('horse', 'лошадь', 'horse', 'scene'),
('bird', 'птица', 'bird', 'scene'),
('butterfly', 'бабочка', 'butterfly', 'scene'),
('fish', 'рыба', 'fish', 'scene'),
('whale', 'кит', 'whale', 'scene'),
('flower', 'цветок', 'flower', 'scene'),
('tree', 'дерево', 'tree', 'scene'),
('garden', 'сад', 'garden', 'scene'),
('mushroom', 'гриб', 'mushroom', 'scene'),
('coral_reef', 'коралловый риф', 'coral reef', 'scene')
ON CONFLICT (id) DO NOTHING;

-- Архитектура
INSERT INTO public.tags (id, name_ru, name_en, category) VALUES
('cathedral', 'собор', 'cathedral', 'scene'),
('mosque', 'мечеть', 'mosque', 'scene'),
('lighthouse', 'маяк', 'lighthouse', 'scene'),
('factory', 'завод', 'factory', 'scene'),
('station', 'вокзал', 'station', 'scene'),
('market', 'рынок', 'market', 'scene'),
('arena', 'арена', 'arena', 'scene'),
('staircase', 'лестница', 'staircase', 'scene'),
('balcony', 'балкон', 'balcony', 'scene'),
('rooftop', 'крыша', 'rooftop', 'scene'),
('alley', 'переулок', 'alley', 'scene'),
('tunnel', 'тоннель', 'tunnel', 'scene'),
('arch', 'арка', 'arch', 'scene'),
('window', 'окно', 'window', 'scene')
ON CONFLICT (id) DO NOTHING;

-- Материалы / текстуры
INSERT INTO public.tags (id, name_ru, name_en, category) VALUES
('crystal', 'кристалл', 'crystal', 'scene'),
('glass', 'стекло', 'glass', 'scene'),
('metal', 'металл', 'metal', 'scene'),
('wood', 'дерево (материал)', 'wood', 'scene'),
('stone', 'камень', 'stone', 'scene'),
('ice', 'лёд', 'ice', 'scene'),
('gold', 'золото', 'gold', 'scene'),
('marble', 'мрамор', 'marble', 'scene'),
('fabric', 'ткань', 'fabric', 'scene')
ON CONFLICT (id) DO NOTHING;

-- Свет / эффекты
INSERT INTO public.tags (id, name_ru, name_en, category) VALUES
('reflection', 'отражение', 'reflection', 'scene'),
('shadow', 'тень', 'shadow', 'scene'),
('ray_of_light', 'луч света', 'ray of light', 'scene'),
('bokeh', 'боке', 'bokeh', 'scene'),
('hologram', 'голограмма', 'hologram', 'scene'),
('particles', 'частицы', 'particles', 'scene'),
('aurora', 'северное сияние', 'aurora', 'scene'),
('lightning', 'молния', 'lightning', 'scene'),
('rainbow', 'радуга', 'rainbow', 'scene'),
('lens_flare', 'блик', 'lens flare', 'scene')
ON CONFLICT (id) DO NOTHING;

-- Персонажи / объекты
INSERT INTO public.tags (id, name_ru, name_en, category) VALUES
('man', 'мужчина', 'man', 'scene'),
('woman', 'женщина', 'woman', 'scene'),
('warrior', 'воин', 'warrior', 'scene'),
('witch', 'ведьма', 'witch', 'scene'),
('wizard', 'маг', 'wizard', 'scene'),
('samurai', 'самурай', 'samurai', 'scene'),
('knight', 'рыцарь', 'knight', 'scene'),
('goddess', 'богиня', 'goddess', 'scene'),
('mask', 'маска', 'mask', 'scene'),
('crown', 'корона', 'crown', 'scene'),
('skull', 'череп', 'skull', 'scene'),
('eye', 'глаз', 'eye', 'scene'),
('hand', 'рука', 'hand', 'scene'),
('wings', 'крылья', 'wings', 'scene'),
('armor', 'доспехи', 'armor', 'scene'),
('clock', 'часы', 'clock', 'scene'),
('book', 'книга', 'book', 'scene'),
('mirror', 'зеркало', 'mirror', 'scene'),
('candle', 'свеча', 'candle', 'scene'),
('lantern', 'фонарь', 'lantern', 'scene')
ON CONFLICT (id) DO NOTHING;
