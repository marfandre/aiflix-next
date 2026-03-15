'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { ColorWheel } from './ColorWheel';
import TagSelector from './TagSelector';

type SearchResultFilm = {
  id: string;
  title: string | null;
  genres: string[] | null;
  similarity?: number;
};

type SearchResultImage = {
  id: string;
  title: string | null;
  colors: string[] | null;
  path: string | null;
  similarity?: number;
};

type SearchResponse = {
  films?: SearchResultFilm[];
  images?: SearchResultImage[];
  query?: string;
  total?: number;
};

// Полные данные изображения для детального просмотра
type ImageDetailData = {
  id: string;
  path: string;
  title: string | null;
  description: string | null;
  prompt: string | null;
  colors: string[] | null;
  model: string | null;
  tags: string[] | null;
  created_at: string | null;
  user_id: string | null;
  profiles: { username: string | null; avatar_url: string | null } | null;
};

// Модели для подсказок
const MODEL_OPTIONS: string[] = [
  'DALL·E',
  'DALL·E 3',
  'Midjourney',
  'Stable Diffusion XL',
  'Stable Diffusion 3',
  'SDXL',
  'Flux',
  'Kandinsky',
  'Leonardo',
  'Ideogram',
  'Playground',
  'Sora',
  'Pika',
  'Runway',
];

const MODEL_SEARCH_KEYS: Record<string, string> = {
  'DALL·E': 'dalle',
  'DALL·E 3': 'dalle',
  'Midjourney': 'midjourney',
  'Stable Diffusion XL': 'sdxl',
  'Stable Diffusion 3': 'sdxl',
  'SDXL': 'sdxl',
  'Flux': 'flux',
  'Kandinsky': 'kandinsky',
  'Leonardo': 'leonardo',
  'Ideogram': 'ideogram',
  'Playground': 'playground',
  'Sora': 'sora',
  'Pika': 'pika',
  'Runway': 'runway',
};

// MOOD_SUGGESTIONS и IMAGE_TYPE_SUGGESTIONS удалены — теперь используем TagSelector

// Палитра цветов для выбора (соответствует корзинам в БД)
const COLOR_PALETTE = [
  { id: 'red', hex: '#FF1744', label: 'Красный', en: 'red' },
  { id: 'orange', hex: '#FF6D00', label: 'Оранжевый', en: 'orange' },
  { id: 'yellow', hex: '#FFEA00', label: 'Жёлтый', en: 'yellow' },
  { id: 'green', hex: '#00E676', label: 'Зелёный', en: 'green' },
  { id: 'teal', hex: '#1DE9B6', label: 'Бирюзовый', en: 'teal' },
  { id: 'cyan', hex: '#00E5FF', label: 'Голубой', en: 'cyan' },
  { id: 'blue', hex: '#2979FF', label: 'Синий', en: 'blue' },
  { id: 'indigo', hex: '#651FFF', label: 'Индиго', en: 'indigo' },
  { id: 'purple', hex: '#D500F9', label: 'Фиолетовый', en: 'purple' },
  { id: 'pink', hex: '#FF4081', label: 'Розовый', en: 'pink' },
  { id: 'brown', hex: '#8D6E63', label: 'Коричневый', en: 'brown' },
  { id: 'black', hex: '#121212', label: 'Чёрный', en: 'black' },
  { id: 'white', hex: '#FAFAFA', label: 'Белый', en: 'white' },
];

// Оттенки для AI-контента: более насыщенные, с неоновыми акцентами
const COLOR_SHADES: Record<string, string[]> = {
  red: ['#FFCDD2', '#FF8A80', '#FF5252', '#FF1744', '#D50000', '#B71C1C', '#7F0000'],
  orange: ['#FFE0B2', '#FFAB40', '#FF9100', '#FF6D00', '#E65100', '#BF360C', '#8D2000'],
  yellow: ['#FFF9C4', '#FFFF00', '#FFEA00', '#FFD600', '#FFC400', '#FFAB00', '#FF8F00'],
  green: ['#B9F6CA', '#69F0AE', '#00E676', '#00C853', '#00A843', '#008836', '#006B24'],
  teal: ['#A7FFEB', '#64FFDA', '#1DE9B6', '#00BFA5', '#009688', '#00796B', '#004D40'],
  cyan: ['#B2EBF2', '#80DEEA', '#4DD0E1', '#00E5FF', '#00B8D4', '#0097A7', '#006064'],
  blue: ['#BBDEFB', '#82B1FF', '#448AFF', '#2979FF', '#2962FF', '#1A46CC', '#0D2899'],
  indigo: ['#D1C4E9', '#B388FF', '#7C4DFF', '#651FFF', '#6200EA', '#4A00B0', '#2E0076'],
  purple: ['#E1BEE7', '#EA80FC', '#E040FB', '#D500F9', '#AA00FF', '#8000BF', '#560080'],
  pink: ['#F8BBD0', '#FF80AB', '#FF4081', '#F50057', '#C51162', '#960D4A', '#670833'],
  brown: ['#D7CCC8', '#BCAAA4', '#A1887F', '#8D6E63', '#6D4C41', '#4E342E', '#3E2723'],
  black: ['#FAFAFA', '#E0E0E0', '#9E9E9E', '#616161', '#424242', '#212121', '#121212'],
  // white не имеет оттенков
};

type ColorPickerMode = 'palette' | 'wheel';
type ColorMapView = 'spectrum' | 'heatmap' | 'bubbles';
type ColorMapEntry = { hex: string; count: number; h: number; s: number; l: number };

function hexToHslMap(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

// Функция маппинга произвольного HEX → ближайший bucket
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.trim().toLowerCase();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (h.length !== 6) return null;
  const num = Number.parseInt(h, 16);
  if (Number.isNaN(num)) return null;
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return { r, g, b };
}

function mapHexToBucket(hex: string): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  let bestId: string | null = null;
  let bestDist = Infinity;

  for (const color of COLOR_PALETTE) {
    const cRgb = hexToRgb(color.hex);
    if (!cRgb) continue;
    const dr = rgb.r - cRgb.r;
    const dg = rgb.g - cRgb.g;
    const db = rgb.b - cRgb.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      bestId = color.id;
    }
  }

  return bestId;
}

/** Маппинг hex → английское название цвета для CLIP-запроса */
function hexToEnglishColorName(hex: string): string {
  // Сначала проверяем точное совпадение с палитрой
  const exact = COLOR_PALETTE.find((c) => c.hex.toLowerCase() === hex.toLowerCase());
  if (exact) return exact.en;

  // Проверяем оттенки — находим какому базовому цвету принадлежит оттенок
  for (const [baseId, shades] of Object.entries(COLOR_SHADES)) {
    if (shades.some((s) => s.toLowerCase() === hex.toLowerCase())) {
      const base = COLOR_PALETTE.find((c) => c.id === baseId);
      // Для оттенков добавляем "light"/"dark" в зависимости от позиции
      const idx = shades.findIndex((s) => s.toLowerCase() === hex.toLowerCase());
      if (base) {
        if (idx <= 1) return `light ${base.en}`;
        if (idx >= 5) return `dark ${base.en}`;
        return base.en;
      }
    }
  }

  // Фолбек: ближайший по RGB
  const bucket = mapHexToBucket(hex);
  const fallback = COLOR_PALETTE.find((c) => c.id === bucket);
  return fallback?.en ?? 'colorful';
}

export default function SearchButton() {
  const [open, setOpen] = useState(false);
  const [includeVideo, setIncludeVideo] = useState(false);
  const [includeImages, setIncludeImages] = useState(false);

  // === ТЕГИ (жанры + атмосфера + сцена) ===
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // === СЕМАНТИЧЕСКИЙ ПОИСК (CLIP) ===
  const [semanticQuery, setSemanticQuery] = useState('');
  const [semanticLoading, setSemanticLoading] = useState(false);

  // === ЦВЕТОВОЙ ПОИСК ===
  const [colorPickerMode, setColorPickerMode] = useState<ColorPickerMode>('palette');
  const [showShades, setShowShades] = useState(false);
  const [pickerPreviewColor, setPickerPreviewColor] = useState('#FF0000'); // цвет для превью

  // Простой режим: массив выбранных цветов (hex-коды)
  const [simpleSelectedColors, setSimpleSelectedColors] = useState<string[]>([]);

  // Цветовая карта
  const [colorMapView, setColorMapView] = useState<ColorMapView>('spectrum');
  const [colorMapData, setColorMapData] = useState<ColorMapEntry[]>([]);
  const [colorMapLoading, setColorMapLoading] = useState(false);
  const [colorMapLoaded, setColorMapLoaded] = useState(false);


  // Модели
  const [modelInput, setModelInput] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [dropdownModelOpen, setDropdownModelOpen] = useState(false);

  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const modelDropdownRef = useRef<HTMLDivElement | null>(null);

  // Drill-down навигация
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<ImageDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const supa = createClientComponentClient();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  // Закрытие dropdown модели при клике вне
  useEffect(() => {
    function handleClickOutsideModel(e: MouseEvent) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setDropdownModelOpen(false);
      }
    }
    if (dropdownModelOpen) {
      document.addEventListener('mousedown', handleClickOutsideModel);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideModel);
    };
  }, [dropdownModelOpen]);

  // Обработчик выбора цвета в простом режиме (теперь принимает hex)
  function handleSimpleColorClick(hexColor: string) {
    setSimpleSelectedColors((prev) => {
      if (prev.includes(hexColor)) {
        return prev.filter((c) => c !== hexColor);
      }
      if (prev.length >= 5) return prev; // максимум 5 цветов
      return [...prev, hexColor];
    });
  }


  // Семантический поиск через CLIP (с автоматическим retry при загрузке модели)
  async function handleSemanticSearch() {
    if (!semanticQuery.trim()) return;
    setError(null);
    setResults(null);
    setSemanticLoading(true);

    try {
      const params = new URLSearchParams();
      params.set('q', semanticQuery.trim());

      if (includeVideo && !includeImages) params.set('type', 'videos');
      else if (includeImages && !includeVideo) params.set('type', 'images');
      else params.set('type', 'all');

      params.set('limit', '30');

      // Retry loop: если модель ещё грузится (503), ждём и повторяем
      let lastRes: Response | null = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        const res = await fetch(`/api/semantic-search?${params.toString()}`);
        lastRes = res;

        if (res.status === 503) {
          // Модель загружается — ждём и повторяем
          const retryAfter = Number(res.headers.get('Retry-After') ?? 5);
          setError(`AI модель загружается... (${attempt + 1}/6)`);
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          setError(null);
          continue;
        }

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'Ошибка семантического поиска');
        }

        const data = (await res.json()) as SearchResponse;
        setResults(data);
        return; // успех
      }

      throw new Error('AI модель не загрузилась. Попробуйте ещё раз.');
    } catch (e: any) {
      console.error('semantic search error', e);
      setError(e?.message ?? 'Ошибка семантического поиска');
    } finally {
      setSemanticLoading(false);
    }
  }

  async function handleSearch() {
    setError(null);
    setResults(null);

    const types: string[] = [];
    if (includeVideo) types.push('video');
    if (includeImages) types.push('images');

    if (!types.length) {
      setError('Выберите хотя бы один тип: Видео или Картинки.');
      return;
    }

    // === ОБЫЧНЫЙ ПОИСК (теги, модели, цвета через CIEDE2000) ===
    const params = new URLSearchParams();
    params.set('types', types.join(','));

    // Цвета → CIEDE2000 (точный цветовой поиск через /api/media-search)
    if (simpleSelectedColors.length) {
      params.set('colorMode', 'simple');
      params.set('hexColors', simpleSelectedColors.join(','));
    }

    if (selectedTags.length) {
      params.set('tags', selectedTags.join(','));
    }

    if (selectedModels.length) {
      const normalizedModels = selectedModels
        .map((label) => MODEL_SEARCH_KEYS[label] ?? label)
        .map((m) => m.trim().toLowerCase())
        .filter(Boolean);
      if (normalizedModels.length) {
        params.set('models', normalizedModels.join(','));
      }
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/media-search?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Ошибка поиска');
      }
      const data = (await res.json()) as SearchResponse;
      setResults(data);
    } catch (e: any) {
      console.error('search error', e);
      setError(e?.message ?? 'Ошибка поиска');
    } finally {
      setLoading(false);
    }
  }

  function resetAll() {
    setSemanticQuery('');
    setSelectedTags([]);
    setModelInput('');
    setSelectedModels([]);
    setSimpleSelectedColors([]);
    setColorPickerMode('palette');
    setShowShades(false);
    setResults(null);
    setError(null);
    setIncludeVideo(false);
    setIncludeImages(false);
    setSelectedImageId(null);
    setDetailData(null);
  }

  // Открыть детальный просмотр изображения
  async function openImageDetail(imageId: string) {
    setSelectedImageId(imageId);
    setDetailLoading(true);
    setDetailData(null);

    try {
      const { data, error } = await supa
        .from('images_meta')
        .select('id, path, title, description, prompt, colors, model, tags, created_at, user_id, profiles(username, avatar_url)')
        .eq('id', imageId)
        .single();

      if (error) {
        console.error('Error fetching image details:', error);
        return;
      }

      const profileData = data.profiles as any;
      setDetailData({
        ...data,
        profiles: profileData ? { username: profileData.username, avatar_url: profileData.avatar_url } : null,
      });
    } catch (err) {
      console.error('Error fetching image details:', err);
    } finally {
      setDetailLoading(false);
    }
  }

  // Вернуться к результатам поиска
  function goBackToResults() {
    setSelectedImageId(null);
    setDetailData(null);
  }

  // Получить публичный URL изображения
  function publicImageUrl(path: string) {
    const { data } = supa.storage.from('images').getPublicUrl(path);
    return data.publicUrl;
  }

  // Копировать промт
  async function handleCopyPrompt() {
    const text = detailData?.prompt || detailData?.description;
    if (!text) return;
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) return;
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error('copy prompt error', e);
    }
  }

  // Форматирование названия модели
  function formatModelName(raw?: string | null): string {
    if (!raw) return 'не указана';
    const labels: Record<string, string> = {
      sora: 'Sora', midjourney: 'MidJourney', 'stable diffusion xl': 'Stable Diffusion XL',
      sdxl: 'SDXL', flux: 'Flux', dalle: 'DALL·E', 'dalle 3': 'DALL·E 3',
    };
    return labels[raw.toLowerCase()] ?? raw;
  }

  const filteredModelOptions = MODEL_OPTIONS.filter(
    (m) =>
      m.toLowerCase().includes(modelInput.toLowerCase()) &&
      !selectedModels.includes(m),
  );

  // Размеры слотов для режима цветов (одинаковые)
  const SLOT_SIZES = [32, 32, 32, 32, 32];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center rounded-xl bg-gray-100 p-2.5 transition hover:bg-gray-200"
        title="Поиск"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 text-gray-400">
          <circle cx="11" cy="11" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="15.5" y1="15.5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 px-4 pt-16">
          <div
            ref={dialogRef}
            className="flex w-full max-w-3xl max-h-[90vh] flex-col rounded-2xl bg-white p-5 shadow-xl"
          >
            {/* DETAIL VIEW */}
            {selectedImageId ? (
              <div className="flex flex-col h-full overflow-auto">
                {/* Back button */}
                <button
                  type="button"
                  onClick={goBackToResults}
                  className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Назад к результатам
                </button>

                {detailLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-gray-500">Загрузка...</p>
                  </div>
                ) : detailData ? (
                  <div className="flex flex-1 flex-col gap-4 md:flex-row">
                    {/* LEFT: Info */}
                    <div className="flex w-full flex-col gap-3 text-sm text-gray-700 md:w-80">
                      {/* Prompt */}
                      <div className="rounded-lg bg-gray-50 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Промт</span>
                          <button
                            type="button"
                            onClick={handleCopyPrompt}
                            disabled={!detailData.prompt && !detailData.description}
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                          >
                            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5">
                              <rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                              <rect x="4" y="4" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                            </svg>
                            Скопировать
                          </button>
                        </div>
                        {detailData.prompt || detailData.description ? (
                          <p className="whitespace-pre-line text-xs text-gray-800">
                            {detailData.prompt || detailData.description}
                          </p>
                        ) : (
                          <p className="text-[11px] text-gray-400">Промт не указан.</p>
                        )}
                      </div>

                      {/* Model */}
                      <div className="text-xs text-gray-600">
                        Модель: <span className="font-medium">{formatModelName(detailData.model)}</span>
                      </div>

                      {/* Tags */}
                      {detailData.tags && detailData.tags.length > 0 && (
                        <div>
                          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Теги</span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {detailData.tags.map((tag) => (
                              <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Author */}
                      {detailData.profiles && (
                        <div className="mt-auto border-t pt-2 text-xs text-gray-500">
                          <Link
                            href={`/u/${encodeURIComponent(detailData.profiles.username || 'user')}`}
                            className="font-medium text-gray-700 hover:underline"
                          >
                            @{detailData.profiles.username || 'user'}
                          </Link>
                          {detailData.created_at && (
                            <div className="mt-0.5">
                              {new Date(detailData.created_at).toLocaleDateString('ru-RU')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* RIGHT: Image + Colors */}
                    <div className="flex flex-1 flex-col">
                      {/* Colors */}
                      {detailData.colors && detailData.colors.length > 0 && (
                        <div className="mb-2 flex items-center gap-1">
                          {detailData.colors.slice(0, 5).map((c, i) => (
                            <div
                              key={c + i}
                              className="rounded-full border border-gray-200"
                              style={{ backgroundColor: c, width: 28, height: 28 }}
                              title={c}
                            />
                          ))}
                        </div>
                      )}

                      {/* Image */}
                      <div className="relative flex flex-1 items-center justify-center rounded-lg bg-gray-50 overflow-hidden">
                        <img
                          src={publicImageUrl(detailData.path)}
                          alt={detailData.title || 'Картинка'}
                          className="max-h-[60vh] w-full object-contain"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Не удалось загрузить изображение.</p>
                )}
              </div>
            ) : (
              <>
                {/* Заголовок */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Поиск</h2>
                    <p className="mt-1 text-xs text-gray-500">
                      Настрой фильтры по цветам, тегам и моделям.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
                      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                {/* TODO: AI-поиск (CLIP) убран. Вернуть когда будет поиск по промптам */}

                {/* Переключатель типов */}
                <div className="mt-4 flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setIncludeVideo((v) => !v)}
                    className={`flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-medium transition ${includeVideo
                      ? 'border-gray-900 text-gray-900 ring-2 ring-gray-900/70'
                      : 'border-gray-200 text-gray-500'
                      }`}
                  >
                    Видео
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncludeImages((v) => !v)}
                    className={`flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-medium transition ${includeImages
                      ? 'border-gray-900 text-gray-900 ring-2 ring-gray-900/70'
                      : 'border-gray-200 text-gray-500'
                      }`}
                  >
                    Картинки
                  </button>
                </div>

                {error && (
                  <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                  </div>
                )}

                {/* Основная сетка */}
                <div className="mt-4 grid flex-1 grid-cols-1 gap-6 overflow-y-auto text-xs md:grid-cols-2">
                  {/* Левая колонка */}
                  <div className="space-y-4">
                    {/* Теги (жанры + атмосфера + сцена) */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Теги (жанры, атмосфера, сцена)
                      </label>
                      <TagSelector
                        selectedTags={selectedTags}
                        onTagsChange={setSelectedTags}
                        maxTags={10}
                        placeholder="Введите тег..."
                      />
                    </div>

                    {/* Модель */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Модель</label>
                      <div className="relative" ref={modelDropdownRef}>
                        {/* Контейнер с чипами и input */}
                        <div
                          className="flex flex-wrap items-center gap-1.5 min-h-[40px] rounded-lg border border-gray-200 bg-white px-2 py-1.5 cursor-text"
                          onClick={() => {
                            setDropdownModelOpen(true);
                            // focus input
                          }}
                        >
                          {selectedModels.map((m) => (
                            <span
                              key={m}
                              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                            >
                              <span>{m}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedModels((prev) => prev.filter((x) => x !== m));
                                }}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <input
                            type="text"
                            value={modelInput}
                            onChange={(e) => setModelInput(e.target.value)}
                            onFocus={() => setDropdownModelOpen(true)}
                            placeholder={selectedModels.length === 0 ? "начните вводить название модели" : ""}
                            className="flex-1 min-w-[100px] border-none outline-none bg-transparent text-sm placeholder:text-gray-400"
                          />
                        </div>
                        {dropdownModelOpen && (
                          <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border bg-white text-xs shadow">
                            {filteredModelOptions.length > 0 ? (
                              filteredModelOptions.map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => {
                                    setSelectedModels((prev) => [...prev, m]);
                                    setModelInput('');
                                    setDropdownModelOpen(false);
                                  }}
                                  className="block w-full px-3 py-1.5 text-left hover:bg-gray-100"
                                >
                                  {m}
                                </button>
                              ))
                            ) : (
                              <div className="px-3 py-1 text-gray-400">Модель не найдена</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Правая колонка: ЦВЕТА */}
                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-600">Поиск по цвету</label>


                    {/* Выбор цветов */}
                    <div>
                      <p className="mb-2 text-[11px] text-gray-500">
                        Выберите цвета — найдутся картинки, где эти цвета присутствуют в любой позиции палитры.
                      </p>

                      {/* 5 слотов для выбранных цветов */}
                      <div className="mb-4 flex items-center justify-center gap-2">
                        {[0, 1, 2, 3, 4].map((slotIdx) => {
                          const hexColor = simpleSelectedColors[slotIdx] ?? null;
                          return (
                            <div
                              key={slotIdx}
                              className={`group relative flex h-8 w-8 items-center justify-center rounded-full border-2 ${hexColor
                                ? 'border-gray-300 cursor-pointer'
                                : 'border-dashed border-gray-300'
                                }`}
                              style={{ backgroundColor: hexColor || '#f9fafb' }}
                              title={hexColor ? `${hexColor} — нажмите чтобы удалить` : `Слот ${slotIdx + 1}`}
                              onClick={() => {
                                if (hexColor) {
                                  setSimpleSelectedColors((prev) => prev.filter((_, i) => i !== slotIdx));
                                }
                              }}
                            >
                              {hexColor && (
                                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                  ✕
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {simpleSelectedColors.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSimpleSelectedColors([])}
                            className="ml-2 text-[10px] text-gray-400 hover:text-gray-600"
                            title="Очистить все"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Вкладки Палитра / Круг */}
                      <div className="mb-3 flex gap-1">
                        <button
                          type="button"
                          onClick={() => setColorPickerMode('palette')}
                          className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${colorPickerMode === 'palette'
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                          Палитра
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setColorPickerMode('wheel');
                            if (!colorMapLoaded) {
                              setColorMapLoading(true);
                              (async () => {
                                try {
                                  let allRows: { colors: string[] | null }[] = [];
                                  let from = 0;
                                  const pageSize = 1000;
                                  while (true) {
                                    const { data, error } = await supa
                                      .from('images_meta')
                                      .select('colors')
                                      .not('colors', 'is', null)
                                      .range(from, from + pageSize - 1);
                                    if (error || !data || data.length === 0) break;
                                    allRows = allRows.concat(data);
                                    if (data.length < pageSize) break;
                                    from += pageSize;
                                  }
                                  const counts: Record<string, number> = {};
                                  for (const row of allRows) {
                                    for (const hex of (row.colors ?? [])) {
                                      if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) continue;
                                      const n = hex.toUpperCase();
                                      counts[n] = (counts[n] || 0) + 1;
                                    }
                                  }
                                  const entries: ColorMapEntry[] = Object.entries(counts)
                                    .map(([hex, count]) => {
                                      const hsl = hexToHslMap(hex);
                                      return { hex, count, h: Math.round(hsl.h), s: Math.round(hsl.s * 100), l: Math.round(hsl.l * 100) };
                                    })
                                    .sort((a, b) => a.h - b.h || b.count - a.count);
                                  setColorMapData(entries);
                                  setColorMapLoaded(true);
                                } catch {}
                                setColorMapLoading(false);
                              })();
                            }
                          }}
                          className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${colorPickerMode === 'wheel'
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                          Цветовая карта
                        </button>
                      </div>

                      {/* Палитра */}
                      {colorPickerMode === 'palette' && (
                        <div>
                          {/* Базовые цвета */}
                          <div className="flex gap-1 mb-2">
                            {COLOR_PALETTE.map((color) => {
                              const isSelected = simpleSelectedColors.includes(color.hex);
                              return (
                                <button
                                  key={color.id}
                                  type="button"
                                  onClick={() => handleSimpleColorClick(color.hex)}
                                  className={`h-5 w-5 rounded-full border-2 transition ${isSelected
                                    ? 'border-gray-900 ring-2 ring-gray-900/40'
                                    : 'border-gray-200 hover:border-gray-400'
                                    }`}
                                  style={{ backgroundColor: color.hex }}
                                  title={color.label}
                                />
                              );
                            })}
                          </div>

                          {/* Кнопка Оттенки — только если выбран хотя бы 1 базовый цвет */}
                          {COLOR_PALETTE.some(c => simpleSelectedColors.includes(c.hex)) && (
                            <button
                              type="button"
                              onClick={() => setShowShades(!showShades)}
                              className="mt-1 flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700"
                            >
                              <span>{showShades ? '▲' : '▼'}</span>
                              <span>{showShades ? 'Скрыть оттенки' : 'Оттенки'}</span>
                            </button>
                          )}

                          {/* Оттенки — только для выбранных базовых цветов */}
                          {showShades && COLOR_PALETTE.some(c => simpleSelectedColors.includes(c.hex)) && (
                            <div className="mt-2 space-y-2">
                              {COLOR_PALETTE.filter(c => simpleSelectedColors.includes(c.hex)).map((baseColor) => {
                                const shades = COLOR_SHADES[baseColor.id] || [];
                                if (shades.length === 0) return null;

                                return (
                                  <div key={baseColor.id} className="flex items-center gap-2">
                                    {/* Базовый цвет слева */}
                                    <div
                                      className="h-5 w-5 rounded-full border-2 border-gray-900 flex-shrink-0"
                                      style={{ backgroundColor: baseColor.hex }}
                                      title={baseColor.label}
                                    />
                                    {/* Оттенки в строку */}
                                    <div className="flex gap-1">
                                      {shades.map((shadeHex, idx) => {
                                        const isShadeSelected = simpleSelectedColors.includes(shadeHex);
                                        return (
                                          <button
                                            key={idx}
                                            type="button"
                                            onClick={() => handleSimpleColorClick(shadeHex)}
                                            className={`h-4 w-4 rounded-full border transition ${isShadeSelected
                                              ? 'border-gray-900 ring-1 ring-gray-900/40'
                                              : 'border-gray-200 hover:border-gray-400'
                                              }`}
                                            style={{ backgroundColor: shadeHex }}
                                            title={`${baseColor.label} оттенок ${idx + 1}`}
                                          />
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Цветовая карта */}
                      {colorPickerMode === 'wheel' && (
                        <div className="flex flex-col gap-3">
                          {/* Переключатель вариантов */}
                          <div className="flex justify-center gap-1.5">
                            {([
                              ['spectrum', 'Спектр'],
                              ['heatmap', 'Тепловая'],
                              ['bubbles', 'Пузырьки'],
                            ] as [ColorMapView, string][]).map(([key, label]) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => setColorMapView(key)}
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition ${
                                  colorMapView === key
                                    ? 'bg-gray-800 text-white'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>

                          {colorMapLoading && (
                            <div className="flex justify-center py-6">
                              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
                            </div>
                          )}

                          {!colorMapLoading && colorMapData.length === 0 && colorMapLoaded && (
                            <p className="text-center text-xs text-gray-400 py-4">Нет данных о цветах</p>
                          )}

                          {!colorMapLoading && colorMapData.length > 0 && (
                            <>
                              {/* === ВАРИАНТ 1: СПЕКТР (непрерывный) === */}
                              {colorMapView === 'spectrum' && (() => {
                                // Группируем цвета в 36 сегментов по 10° оттенка
                                const SEGMENTS = 36;
                                const segSize = 360 / SEGMENTS;
                                const segments: { colors: ColorMapEntry[]; totalCount: number; avgHex: string }[] =
                                  Array.from({ length: SEGMENTS }, () => ({ colors: [], totalCount: 0, avgHex: '' }));

                                for (const c of colorMapData) {
                                  const idx = Math.min(Math.floor(c.h / segSize), SEGMENTS - 1);
                                  segments[idx].colors.push(c);
                                  segments[idx].totalCount += c.count;
                                }

                                // Для каждого сегмента вычисляем взвешенный средний цвет
                                for (const seg of segments) {
                                  if (seg.colors.length === 0) continue;
                                  let rSum = 0, gSum = 0, bSum = 0, wSum = 0;
                                  for (const c of seg.colors) {
                                    const rr = parseInt(c.hex.slice(1, 3), 16);
                                    const gg = parseInt(c.hex.slice(3, 5), 16);
                                    const bb = parseInt(c.hex.slice(5, 7), 16);
                                    rSum += rr * c.count; gSum += gg * c.count; bSum += bb * c.count;
                                    wSum += c.count;
                                  }
                                  const toH = (v: number) => Math.round(v / wSum).toString(16).padStart(2, '0');
                                  seg.avgHex = `#${toH(rSum)}${toH(gSum)}${toH(bSum)}`;
                                }

                                // Заполняем пустые сегменты интерполяцией соседних
                                const filled = segments.map(s => s.avgHex || '');
                                for (let i = 0; i < SEGMENTS; i++) {
                                  if (filled[i]) continue;
                                  // Найти ближайший заполненный слева и справа
                                  let left = -1, right = -1;
                                  for (let d = 1; d < SEGMENTS; d++) {
                                    if (left < 0 && filled[(i - d + SEGMENTS) % SEGMENTS]) left = (i - d + SEGMENTS) % SEGMENTS;
                                    if (right < 0 && filled[(i + d) % SEGMENTS]) right = (i + d) % SEGMENTS;
                                    if (left >= 0 && right >= 0) break;
                                  }
                                  if (left >= 0 && right >= 0) {
                                    const lc = filled[left], rc = filled[right];
                                    const dL = ((i - left) + SEGMENTS) % SEGMENTS;
                                    const dR = ((right - i) + SEGMENTS) % SEGMENTS;
                                    const t = dL / (dL + dR);
                                    const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
                                    const lr = parseInt(lc.slice(1, 3), 16), lg = parseInt(lc.slice(3, 5), 16), lb = parseInt(lc.slice(5, 7), 16);
                                    const rr = parseInt(rc.slice(1, 3), 16), rg = parseInt(rc.slice(3, 5), 16), rb = parseInt(rc.slice(5, 7), 16);
                                    filled[i] = `#${lerp(lr, rr).toString(16).padStart(2, '0')}${lerp(lg, rg).toString(16).padStart(2, '0')}${lerp(lb, rb).toString(16).padStart(2, '0')}`;
                                  } else if (left >= 0) {
                                    filled[i] = filled[left];
                                  } else if (right >= 0) {
                                    filled[i] = filled[right];
                                  }
                                }

                                const maxCount = Math.max(...segments.map(s => s.totalCount), 1);
                                const gradientStops = filled.map((hex, i) => `${hex || '#333'} ${(i / SEGMENTS) * 100}%`).join(', ');

                                return (
                                  <div className="flex flex-col gap-2">
                                    {/* Непрерывная спектр-полоса из реальных цветов */}
                                    <div
                                      className="relative w-full rounded-xl overflow-hidden cursor-pointer"
                                      style={{
                                        background: `linear-gradient(to right, ${gradientStops})`,
                                        height: 48,
                                      }}
                                    >
                                      {/* Полупрозрачные столбики высоты = количество контента */}
                                      <div className="absolute inset-0 flex">
                                        {segments.map((seg, i) => (
                                          <button
                                            key={i}
                                            type="button"
                                            className="relative h-full hover:brightness-125 transition-all"
                                            style={{
                                              flex: 1,
                                              background: seg.totalCount > 0
                                                ? `linear-gradient(to top, ${seg.avgHex || filled[i]} ${Math.round((seg.totalCount / maxCount) * 100)}%, transparent ${Math.round((seg.totalCount / maxCount) * 100)}%)`
                                                : 'transparent',
                                              opacity: seg.totalCount > 0 ? 1 : 0.3,
                                            }}
                                            title={seg.totalCount > 0 ? `${seg.colors.length} цветов, ${seg.totalCount} изобр.` : 'Нет контента'}
                                            onClick={() => {
                                              // Берём самый популярный цвет в сегменте
                                              const best = seg.colors.sort((a, b) => b.count - a.count)[0];
                                              if (best && !simpleSelectedColors.includes(best.hex) && simpleSelectedColors.length < 5) {
                                                handleSimpleColorClick(best.hex);
                                              }
                                            }}
                                          />
                                        ))}
                                      </div>
                                    </div>

                                    {/* Вторая строка — развёрнутая полоса с плавным градиентом */}
                                    <div
                                      className="w-full rounded-lg overflow-hidden"
                                      style={{
                                        background: `linear-gradient(to right, ${gradientStops})`,
                                        height: 18,
                                      }}
                                    />

                                    {/* Интерактивные сегменты-кнопки под полосой */}
                                    <div className="flex gap-[1px] w-full">
                                      {segments.filter(s => s.totalCount > 0).map((seg, i) => {
                                        const best = seg.colors.sort((a, b) => b.count - a.count)[0];
                                        const h = 14 + (seg.totalCount / maxCount) * 22;
                                        return (
                                          <button
                                            key={i}
                                            type="button"
                                            onClick={() => {
                                              if (best && !simpleSelectedColors.includes(best.hex) && simpleSelectedColors.length < 5) {
                                                handleSimpleColorClick(best.hex);
                                              }
                                            }}
                                            className="rounded-sm transition-transform hover:scale-y-150 hover:z-10"
                                            style={{
                                              flex: seg.totalCount,
                                              height: h,
                                              backgroundColor: best?.hex || '#999',
                                            }}
                                            title={`${best?.hex} — ${seg.totalCount} изобр.`}
                                          />
                                        );
                                      })}
                                    </div>

                                    <p className="text-center text-[10px] text-gray-400">
                                      Высота = количество контента. Нажмите на участок, чтобы искать по цвету.
                                    </p>
                                  </div>
                                );
                              })()}

                              {/* === ВАРИАНТ 2: ТЕПЛОВАЯ КАРТА === */}
                              {colorMapView === 'heatmap' && (() => {
                                // Группируем по 12 секторам оттенка × 5 уровней светлоты
                                const HUE_SEGMENTS = 12;
                                const LIGHT_SEGMENTS = 5;
                                const grid: { count: number; totalHex: string[]; dominantHex: string }[][] = Array.from(
                                  { length: LIGHT_SEGMENTS },
                                  () => Array.from({ length: HUE_SEGMENTS }, () => ({ count: 0, totalHex: [], dominantHex: '#000' }))
                                );

                                const maxCellCount = { value: 0 };

                                for (const c of colorMapData) {
                                  const hIdx = Math.min(Math.floor(c.h / (360 / HUE_SEGMENTS)), HUE_SEGMENTS - 1);
                                  const lIdx = Math.min(Math.floor(c.l / (100 / LIGHT_SEGMENTS)), LIGHT_SEGMENTS - 1);
                                  // Инвертируем: тёмные внизу, светлые вверху
                                  const lRow = LIGHT_SEGMENTS - 1 - lIdx;
                                  grid[lRow][hIdx].count += c.count;
                                  grid[lRow][hIdx].totalHex.push(c.hex);
                                  if (c.count > 0) {
                                    // Доминантный = с наибольшим количеством
                                    const existing = grid[lRow][hIdx];
                                    if (!existing.dominantHex || existing.dominantHex === '#000') {
                                      existing.dominantHex = c.hex;
                                    }
                                  }
                                  if (grid[lRow][hIdx].count > maxCellCount.value) {
                                    maxCellCount.value = grid[lRow][hIdx].count;
                                  }
                                }

                                // Для каждой ячейки выберем наиболее частый цвет
                                for (const row of grid) {
                                  for (const cell of row) {
                                    if (cell.totalHex.length > 0) {
                                      // Берём медианный цвет из списка
                                      cell.dominantHex = cell.totalHex[Math.floor(cell.totalHex.length / 2)];
                                    }
                                  }
                                }

                                const hueLabels = ['Кр', 'Ор', 'Жл', 'Зл', 'Зл', 'Бр', 'Гл', 'Сн', 'Ин', 'Фл', 'Рз', 'Рз'];

                                return (
                                  <div className="flex flex-col gap-1.5">
                                    <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${HUE_SEGMENTS}, 1fr)` }}>
                                      {grid.flat().map((cell, i) => {
                                        const hIdx = i % HUE_SEGMENTS;
                                        const intensity = maxCellCount.value > 0 ? cell.count / maxCellCount.value : 0;
                                        return (
                                          <button
                                            key={i}
                                            type="button"
                                            onClick={() => {
                                              if (cell.count > 0 && cell.dominantHex !== '#000' && !simpleSelectedColors.includes(cell.dominantHex) && simpleSelectedColors.length < 5) {
                                                handleSimpleColorClick(cell.dominantHex);
                                              }
                                            }}
                                            className="aspect-square rounded-sm transition-transform hover:scale-110 hover:z-10"
                                            style={{
                                              backgroundColor: cell.count > 0 ? cell.dominantHex : '#F3F4F6',
                                              opacity: cell.count > 0 ? 0.3 + intensity * 0.7 : 0.3,
                                              boxShadow: cell.count > 0 ? `inset 0 0 0 1px rgba(255,255,255,0.2)` : 'none',
                                            }}
                                            title={cell.count > 0 ? `${cell.dominantHex} — ${cell.count} изобр.` : hueLabels[hIdx]}
                                          />
                                        );
                                      })}
                                    </div>
                                    <div className="flex justify-between px-0.5">
                                      {hueLabels.map((l, i) => (
                                        <span key={i} className="text-[8px] text-gray-400">{l}</span>
                                      ))}
                                    </div>
                                    <p className="text-center text-[10px] text-gray-400">
                                      Яркость ячейки = количество контента. По горизонтали — оттенок, по вертикали — светлота.
                                    </p>
                                  </div>
                                );
                              })()}

                              {/* === ВАРИАНТ 3: ПУЗЫРЬКИ === */}
                              {colorMapView === 'bubbles' && (() => {
                                const maxCount = Math.max(...colorMapData.map(c => c.count));
                                // Группируем по hue-секторам для кластеризации
                                const HUE_GROUPS = [
                                  { label: 'Красные', from: 345, to: 15 },
                                  { label: 'Оранжевые', from: 15, to: 45 },
                                  { label: 'Жёлтые', from: 45, to: 70 },
                                  { label: 'Зелёные', from: 70, to: 160 },
                                  { label: 'Бирюзовые', from: 160, to: 200 },
                                  { label: 'Синие', from: 200, to: 260 },
                                  { label: 'Фиолетовые', from: 260, to: 310 },
                                  { label: 'Розовые', from: 310, to: 345 },
                                ];

                                const inRange = (h: number, from: number, to: number) => {
                                  if (from > to) return h >= from || h < to; // wrap around (красные)
                                  return h >= from && h < to;
                                };

                                // Группируем + берём топ-5 по каждой группе
                                const groups = HUE_GROUPS.map(g => ({
                                  label: g.label,
                                  colors: colorMapData
                                    .filter(c => inRange(c.h, g.from, g.to) && c.s > 10)
                                    .sort((a, b) => b.count - a.count)
                                    .slice(0, 6),
                                })).filter(g => g.colors.length > 0);

                                // Добавляем нейтральные (s <= 10)
                                const neutrals = colorMapData
                                  .filter(c => c.s <= 10)
                                  .sort((a, b) => b.count - a.count)
                                  .slice(0, 6);
                                if (neutrals.length > 0) {
                                  groups.push({ label: 'Нейтральные', colors: neutrals });
                                }

                                return (
                                  <div className="flex flex-col gap-3">
                                    {groups.map(g => (
                                      <div key={g.label}>
                                        <div className="mb-1 text-[10px] font-medium text-gray-500">{g.label}</div>
                                        <div className="flex flex-wrap items-end gap-1.5">
                                          {g.colors.map((c, i) => {
                                            const size = 18 + (c.count / maxCount) * 30;
                                            return (
                                              <button
                                                key={c.hex + i}
                                                type="button"
                                                onClick={() => {
                                                  if (!simpleSelectedColors.includes(c.hex) && simpleSelectedColors.length < 5) {
                                                    handleSimpleColorClick(c.hex);
                                                  }
                                                }}
                                                className="rounded-full border border-white/50 transition-transform hover:scale-125 hover:z-10"
                                                style={{
                                                  backgroundColor: c.hex,
                                                  width: size,
                                                  height: size,
                                                  boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                                                }}
                                                title={`${c.hex} — ${c.count} изобр.`}
                                              />
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                    <p className="text-center text-[10px] text-gray-400">
                                      Размер пузырька = популярность цвета. Нажмите для поиска.
                                    </p>
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>


                {/* Футер */}
                <div className="mt-4 border-t pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] text-gray-500">
                      Выбор по цветам и жанрам можно комбинировать.
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={resetAll}
                        className="rounded-full border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        Сбросить
                      </button>
                      <button
                        type="button"
                        onClick={handleSearch}
                        disabled={loading || semanticLoading}
                        className="rounded-full bg-gray-900 px-3 py-1 text-xs text-white hover:bg-gray-800 disabled:opacity-50"
                      >
                        {loading || semanticLoading ? 'Ищем…' : 'Найти'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Ошибка */}
                {error && (
                  <p className="mt-3 text-sm text-red-600">{error}</p>
                )}

                {/* Результаты */}
                <div className="mt-4 space-y-4 border-t pt-3">
                  {results && !(results.films?.length ?? 0) && !(results.images?.length ?? 0) && (
                    <p className="text-sm text-gray-500">Ничего не найдено по заданным фильтрам.</p>
                  )}

                  {results?.films?.length ? (
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Видео</h3>
                      <ul className="space-y-2">
                        {results.films.map((f) => (
                          <li key={f.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                            <div className="min-w-0 flex items-center gap-2">
                              <div className="truncate font-medium text-gray-900">
                                {(f.title ?? '').trim() || 'Без названия'}
                              </div>
                              {f.similarity != null && (
                                <span className="shrink-0 rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                                  {Math.round(f.similarity * 100)}%
                                </span>
                              )}
                            </div>
                            <Link href={`/film/${f.id}`} className="ml-3 shrink-0 text-xs font-medium text-blue-600 hover:underline">
                              Открыть
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {results?.images?.length ? (
                    <div>
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Картинки</h3>
                      <div className="grid grid-cols-6 gap-2">
                        {results.images.map((im) => {
                          const imageUrl = im.path
                            ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/${im.path}`
                            : null;
                          return (
                            <button
                              key={im.id}
                              type="button"
                              onClick={() => openImageDetail(im.id)}
                              className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 transition hover:ring-2 hover:ring-blue-500"
                            >
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={im.title || 'Картинка'}
                                  className="h-full w-full object-cover transition group-hover:scale-105"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                                  Нет превью
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
