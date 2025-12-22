'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ColorWheel } from './ColorWheel';
import TagSelector from './TagSelector';

type SearchResultFilm = {
  id: string;
  title: string | null;
  genres: string[] | null;
};

type SearchResultImage = {
  id: string;
  title: string | null;
  colors: string[] | null;
};

type SearchResponse = {
  films?: SearchResultFilm[];
  images?: SearchResultImage[];
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
  { id: 'red', hex: '#FF3B30', label: 'Красный' },
  { id: 'orange', hex: '#FF9500', label: 'Оранжевый' },
  { id: 'yellow', hex: '#FFD60A', label: 'Жёлтый' },
  { id: 'green', hex: '#34C759', label: 'Зелёный' },
  { id: 'teal', hex: '#00C7BE', label: 'Бирюзовый' },
  { id: 'cyan', hex: '#32ADE6', label: 'Голубой' },
  { id: 'blue', hex: '#007AFF', label: 'Синий' },
  { id: 'indigo', hex: '#5856D6', label: 'Индиго' },
  { id: 'purple', hex: '#AF52DE', label: 'Фиолетовый' },
  { id: 'pink', hex: '#FF2D55', label: 'Розовый' },
  { id: 'brown', hex: '#A2845E', label: 'Коричневый' },
  { id: 'gray', hex: '#8E8E93', label: 'Серый' },
];

// Оттенки для каждого базового цвета (светлые → тёмные)
const COLOR_SHADES: Record<string, string[]> = {
  red: ['#FFE5E5', '#FFCCCC', '#FF9999', '#FF6666', '#CC2F27', '#991F1D', '#661514'],
  orange: ['#FFF0E5', '#FFD9BF', '#FFB380', '#FF8C40', '#CC7700', '#995900', '#663C00'],
  yellow: ['#FFFBE5', '#FFF5BF', '#FFEC80', '#FFE340', '#CCAB08', '#998006', '#665504'],
  green: ['#E8F8ED', '#C7F0D5', '#8FE1AB', '#57D281', '#2AA047', '#1F7835', '#155023'],
  teal: ['#E5FFFE', '#BFFBF9', '#80F7F2', '#40F3EB', '#009F98', '#00776F', '#004F49'],
  cyan: ['#E9F6FC', '#C9E9F8', '#93D3F1', '#5DBDEA', '#2889B8', '#1E678A', '#14455C'],
  blue: ['#E5F0FF', '#BFD9FF', '#80B3FF', '#408CFF', '#0062CC', '#004A99', '#003166'],
  indigo: ['#EEEDFA', '#D5D4F2', '#ABA8E5', '#817DD8', '#4643AB', '#343280', '#232155'],
  purple: ['#F5EAFA', '#E7CFF2', '#CF9FE5', '#B76FD8', '#8C42B2', '#693185', '#462158'],
  pink: ['#FFE8EC', '#FFCCD5', '#FF99AB', '#FF6681', '#CC2444', '#991B33', '#661222'],
  brown: ['#F5F0EA', '#E8DDD0', '#D1BBA1', '#BA9972', '#82694B', '#615038', '#413625'],
  gray: ['#F5F5F5', '#E5E5E5', '#CCCCCC', '#B3B3B3', '#717175', '#555558', '#38383B'],
};

type ColorSearchMode = 'simple' | 'dominant';
type ColorPickerMode = 'palette' | 'wheel';

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

export default function SearchButton() {
  const [open, setOpen] = useState(false);
  const [includeVideo, setIncludeVideo] = useState(false);
  const [includeImages, setIncludeImages] = useState(false);

  // === ТЕГИ (жанры + атмосфера + сцена) ===
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // === ЦВЕТОВОЙ ПОИСК ===
  const [colorSearchMode, setColorSearchMode] = useState<ColorSearchMode>('simple');
  const [colorPickerMode, setColorPickerMode] = useState<ColorPickerMode>('palette');
  const [showShades, setShowShades] = useState(false);

  // Простой режим: массив выбранных цветов (bucket id)
  const [simpleSelectedColors, setSimpleSelectedColors] = useState<string[]>([]);

  // Режим по доминантности: 5 слотов
  const [dominantSlots, setDominantSlots] = useState<(string | null)[]>([null, null, null, null, null]);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);

  // Модели
  const [modelInput, setModelInput] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [dropdownModelOpen, setDropdownModelOpen] = useState(false);

  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const modelDropdownRef = useRef<HTMLDivElement | null>(null);

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

  // Обработчик выбора цвета в простом режиме
  function handleSimpleColorClick(colorId: string) {
    setSimpleSelectedColors((prev) => {
      if (prev.includes(colorId)) {
        return prev.filter((c) => c !== colorId);
      }
      return [...prev, colorId];
    });
  }

  // Обработчик выбора цвета в режиме доминантности
  function handleDominantColorClick(colorId: string) {
    if (activeSlotIndex === null) return;

    setDominantSlots((prev) => {
      const next = [...prev];
      // Если этот цвет уже в текущем слоте — убираем
      if (next[activeSlotIndex] === colorId) {
        next[activeSlotIndex] = null;
      } else {
        next[activeSlotIndex] = colorId;
      }
      return next;
    });
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

    const params = new URLSearchParams();
    params.set('types', types.join(','));

    // Теги (жанры + атмосфера + сцена)
    if (selectedTags.length) {
      params.set('tags', selectedTags.join(','));
    }

    // Модели
    if (selectedModels.length) {
      const normalizedModels = selectedModels
        .map((label) => MODEL_SEARCH_KEYS[label] ?? label)
        .map((m) => m.trim().toLowerCase())
        .filter(Boolean);
      if (normalizedModels.length) {
        params.set('models', normalizedModels.join(','));
      }
    }

    // === ЦВЕТА ===
    if (colorSearchMode === 'simple') {
      // Простой режим: ищем картинки где любой из выбранных цветов есть в любом слоте
      if (simpleSelectedColors.length) {
        params.set('colorMode', 'simple');
        params.set('colors', simpleSelectedColors.join(','));
      }
    } else {
      // Режим по доминантности: передаём каждый слот отдельно
      const filledSlots = dominantSlots
        .map((color, index) => (color ? { index, color } : null))
        .filter(Boolean) as { index: number; color: string }[];

      if (filledSlots.length) {
        params.set('colorMode', 'dominant');
        // Формат: slot0=red,slot2=blue (только заполненные)
        filledSlots.forEach(({ index, color }) => {
          params.set(`slot${index}`, color);
        });
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
    setSelectedTags([]);
    setModelInput('');
    setSelectedModels([]);
    setSimpleSelectedColors([]);
    setDominantSlots([null, null, null, null, null]);
    setActiveSlotIndex(null);
    setColorPickerMode('palette');
    setShowShades(false);
    setResults(null);
    setError(null);
    setIncludeVideo(false);
    setIncludeImages(false);
  }

  const filteredModelOptions = MODEL_OPTIONS.filter(
    (m) =>
      m.toLowerCase().includes(modelInput.toLowerCase()) &&
      !selectedModels.includes(m),
  );

  // Размеры слотов для режима доминантности (убывающие)
  const SLOT_SIZES = [36, 30, 26, 22, 18];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center rounded-xl bg-gray-100 p-2 transition hover:bg-gray-200"
        title="Поиск"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 text-gray-400">
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
            {/* Заголовок */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Поиск по цветам и жанрам</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Настрой фильтры, а мы покажем подходящие видео и картинки.
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

                {/* Переключатель режима */}
                <div className="mb-3 flex border-b text-xs font-medium text-gray-500">
                  <button
                    type="button"
                    onClick={() => setColorSearchMode('simple')}
                    className={`relative px-3 pb-2 pt-1 ${colorSearchMode === 'simple' ? 'text-black' : 'text-gray-500'
                      }`}
                  >
                    Простой
                    {colorSearchMode === 'simple' && (
                      <span className="absolute inset-x-1 -bottom-[1px] h-[2px] rounded-full bg-black" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setColorSearchMode('dominant')}
                    className={`relative px-3 pb-2 pt-1 ${colorSearchMode === 'dominant' ? 'text-black' : 'text-gray-500'
                      }`}
                  >
                    По доминантности
                    {colorSearchMode === 'dominant' && (
                      <span className="absolute inset-x-1 -bottom-[1px] h-[2px] rounded-full bg-black" />
                    )}
                  </button>
                </div>

                {/* === ПРОСТОЙ РЕЖИМ === */}
                {colorSearchMode === 'simple' && (
                  <div>
                    <p className="mb-2 text-[11px] text-gray-500">
                      Выберите цвета — найдутся картинки, где эти цвета присутствуют в любой позиции палитры.
                    </p>

                    {/* 5 слотов для выбранных цветов */}
                    <div className="mb-4 flex items-center justify-center gap-2">
                      {[0, 1, 2, 3, 4].map((slotIdx) => {
                        const colorId = simpleSelectedColors[slotIdx] ?? null;
                        const colorData = colorId ? COLOR_PALETTE.find((c) => c.id === colorId) : null;
                        return (
                          <div
                            key={slotIdx}
                            className={`group relative flex h-8 w-8 items-center justify-center rounded-full border-2 ${colorData
                              ? 'border-gray-300 cursor-pointer'
                              : 'border-dashed border-gray-300'
                              }`}
                            style={{ backgroundColor: colorData?.hex || '#f9fafb' }}
                            title={colorData ? `${colorData.label} — нажмите чтобы удалить` : `Слот ${slotIdx + 1}`}
                            onClick={() => {
                              if (colorData) {
                                // Удаляем только этот цвет по индексу
                                setSimpleSelectedColors((prev) => prev.filter((_, i) => i !== slotIdx));
                              }
                            }}
                          >
                            {/* Крестик при наведении на заполненный слот */}
                            {colorData && (
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
                        onClick={() => setColorPickerMode('wheel')}
                        className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${colorPickerMode === 'wheel'
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                      >
                        Круг
                      </button>
                    </div>

                    {/* Палитра */}
                    {colorPickerMode === 'palette' && (
                      <div>
                        {/* 12 базовых цветов — в одну строку */}
                        <div className="flex gap-1">
                          {COLOR_PALETTE.map((color) => {
                            const isSelected = simpleSelectedColors.includes(color.id);
                            return (
                              <button
                                key={color.id}
                                type="button"
                                onClick={() => handleSimpleColorClick(color.id)}
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

                        {/* Кнопка Показать оттенки */}
                        <button
                          type="button"
                          onClick={() => setShowShades(!showShades)}
                          className="mt-3 flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700"
                        >
                          <span>{showShades ? '▲' : '▼'}</span>
                          <span>{showShades ? 'Скрыть оттенки' : 'Показать оттенки'}</span>
                        </button>

                        {/* Оттенки — матричный формат как в Word */}
                        {showShades && (
                          <div className="mt-3 rounded-lg border bg-gray-50 p-3">
                            <div className="mb-2 text-[11px] font-medium text-gray-600">
                              Оттенки (кликните для выбора базового цвета)
                            </div>
                            {/* Матрица: колонки = цвета, строки = оттенки */}
                            <div className="flex flex-col gap-1">
                              {/* Строка с базовыми цветами сверху */}
                              <div className="flex gap-1">
                                {COLOR_PALETTE.map((baseColor) => (
                                  <button
                                    key={baseColor.id}
                                    type="button"
                                    onClick={() => handleSimpleColorClick(baseColor.id)}
                                    className={`h-5 w-5 rounded-full border-2 transition ${simpleSelectedColors.includes(baseColor.id)
                                      ? 'border-gray-900 ring-1 ring-gray-900/40'
                                      : 'border-transparent hover:border-gray-400'
                                      }`}
                                    style={{ backgroundColor: baseColor.hex }}
                                    title={baseColor.label}
                                  />
                                ))}
                              </div>
                              {/* Строки оттенков (от светлого к тёмному) */}
                              {[0, 1, 2, 3, 4, 5, 6].map((shadeIdx) => (
                                <div key={shadeIdx} className="flex gap-1">
                                  {COLOR_PALETTE.map((baseColor) => {
                                    const shadeHex = COLOR_SHADES[baseColor.id]?.[shadeIdx];
                                    if (!shadeHex) return <div key={baseColor.id} className="h-5 w-5" />;
                                    return (
                                      <button
                                        key={baseColor.id}
                                        type="button"
                                        onClick={() => handleSimpleColorClick(baseColor.id)}
                                        className={`h-5 w-5 rounded-full border transition ${simpleSelectedColors.includes(baseColor.id)
                                          ? 'border-gray-400'
                                          : 'border-transparent hover:border-gray-400'
                                          }`}
                                        style={{ backgroundColor: shadeHex }}
                                        title={`${baseColor.label}`}
                                      />
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Цветовой круг */}
                    {colorPickerMode === 'wheel' && (
                      <div className="flex flex-col items-center">
                        <ColorWheel
                          size={160}
                          onClick={(c) => {
                            const bucket = mapHexToBucket(c.hex);
                            if (bucket) handleSimpleColorClick(bucket);
                          }}
                        />
                        <p className="mt-2 text-center text-[10px] text-gray-400">
                          Кликните на цвет — он конвертируется в ближайший базовый
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* === РЕЖИМ ПО ДОМИНАНТНОСТИ === */}
                {colorSearchMode === 'dominant' && (
                  <div>
                    <p className="mb-3 text-[11px] text-gray-500">
                      Кликните на кружок, затем выберите цвет. Левый кружок — самый доминантный цвет, правый — наименее значимый.
                    </p>

                    {/* 5 слотов */}
                    <div className="mb-4 flex items-center justify-center gap-3">
                      {dominantSlots.map((colorId, index) => {
                        const size = SLOT_SIZES[index];
                        const isActive = activeSlotIndex === index;
                        const colorData = colorId ? COLOR_PALETTE.find((c) => c.id === colorId) : null;

                        return (
                          <div
                            key={index}
                            className="group relative"
                            style={{ width: size, height: size }}
                          >
                            <button
                              type="button"
                              onClick={() => setActiveSlotIndex(isActive ? null : index)}
                              className={`flex h-full w-full items-center justify-center rounded-full border-2 transition ${isActive
                                ? 'border-gray-900 ring-2 ring-gray-900/40'
                                : 'border-gray-300'
                                }`}
                              style={{
                                backgroundColor: colorData?.hex || '#f3f4f6',
                              }}
                              title={`Слот ${index + 1}${colorData ? `: ${colorData.label}` : ''}`}
                            >
                              {!colorData && (
                                <span className="text-[9px] text-gray-400">{index + 1}</span>
                              )}
                            </button>
                            {/* Крестик для удаления цвета */}
                            {colorData && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDominantSlots((prev) => {
                                    const next = [...prev];
                                    next[index] = null;
                                    return next;
                                  });
                                }}
                                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Удалить цвет"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {dominantSlots.some((s) => s !== null) && (
                        <button
                          type="button"
                          onClick={() => setDominantSlots([null, null, null, null, null])}
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
                        onClick={() => setColorPickerMode('wheel')}
                        className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${colorPickerMode === 'wheel'
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                      >
                        Круг
                      </button>
                    </div>

                    {/* Подсказка какой слот заполняется */}
                    {activeSlotIndex !== null && (
                      <div className="mb-2 text-[11px] text-gray-500">
                        Выберите цвет для слота {activeSlotIndex + 1}
                        {activeSlotIndex === 0 && ' (доминантный)'}
                      </div>
                    )}
                    {activeSlotIndex === null && (
                      <div className="mb-2 text-[11px] text-gray-400">
                        Кликните на слот выше, чтобы выбрать для него цвет
                      </div>
                    )}

                    {/* Палитра */}
                    {colorPickerMode === 'palette' && (
                      <div>
                        {/* 12 базовых цветов */}
                        <div className="flex gap-1">
                          {COLOR_PALETTE.map((color) => {
                            const isSelectedInSlot = activeSlotIndex !== null && dominantSlots[activeSlotIndex] === color.id;
                            return (
                              <button
                                key={color.id}
                                type="button"
                                onClick={() => handleDominantColorClick(color.id)}
                                disabled={activeSlotIndex === null}
                                className={`h-5 w-5 rounded-full border-2 transition ${isSelectedInSlot
                                  ? 'border-gray-900 ring-2 ring-gray-900/40'
                                  : activeSlotIndex === null
                                    ? 'border-gray-200 opacity-50 cursor-not-allowed'
                                    : 'border-gray-200 hover:border-gray-400'
                                  }`}
                                style={{ backgroundColor: color.hex }}
                                title={color.label}
                              />
                            );
                          })}
                        </div>

                        {/* Кнопка Показать оттенки */}
                        <button
                          type="button"
                          onClick={() => setShowShades(!showShades)}
                          className="mt-3 flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700"
                        >
                          <span>{showShades ? '▲' : '▼'}</span>
                          <span>{showShades ? 'Скрыть оттенки' : 'Показать оттенки'}</span>
                        </button>

                        {/* Оттенки — матричный формат */}
                        {showShades && (
                          <div className="mt-3 rounded-lg border bg-gray-50 p-3">
                            <div className="mb-2 text-[11px] font-medium text-gray-600">
                              Оттенки (кликните для выбора)
                            </div>
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-1">
                                {COLOR_PALETTE.map((baseColor) => (
                                  <button
                                    key={baseColor.id}
                                    type="button"
                                    onClick={() => handleDominantColorClick(baseColor.id)}
                                    disabled={activeSlotIndex === null}
                                    className={`h-5 w-5 rounded-full border-2 transition ${activeSlotIndex !== null && dominantSlots[activeSlotIndex] === baseColor.id
                                      ? 'border-gray-900 ring-1 ring-gray-900/40'
                                      : activeSlotIndex === null
                                        ? 'border-transparent opacity-50 cursor-not-allowed'
                                        : 'border-transparent hover:border-gray-400'
                                      }`}
                                    style={{ backgroundColor: baseColor.hex }}
                                    title={baseColor.label}
                                  />
                                ))}
                              </div>
                              {[0, 1, 2, 3, 4, 5, 6].map((shadeIdx) => (
                                <div key={shadeIdx} className="flex gap-1">
                                  {COLOR_PALETTE.map((baseColor) => {
                                    const shadeHex = COLOR_SHADES[baseColor.id]?.[shadeIdx];
                                    if (!shadeHex) return <div key={baseColor.id} className="h-5 w-5" />;
                                    return (
                                      <button
                                        key={baseColor.id}
                                        type="button"
                                        onClick={() => handleDominantColorClick(baseColor.id)}
                                        disabled={activeSlotIndex === null}
                                        className={`h-5 w-5 rounded-full border transition ${activeSlotIndex !== null && dominantSlots[activeSlotIndex] === baseColor.id
                                          ? 'border-gray-400'
                                          : activeSlotIndex === null
                                            ? 'border-transparent opacity-50 cursor-not-allowed'
                                            : 'border-transparent hover:border-gray-400'
                                          }`}
                                        style={{ backgroundColor: shadeHex }}
                                        title={baseColor.label}
                                      />
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Цветовой круг */}
                    {colorPickerMode === 'wheel' && (
                      <div className="flex flex-col items-center">
                        <ColorWheel
                          size={160}
                          onClick={(c) => {
                            const bucket = mapHexToBucket(c.hex);
                            if (bucket) handleDominantColorClick(bucket);
                          }}
                        />
                        <p className="mt-2 text-center text-[10px] text-gray-400">
                          {activeSlotIndex !== null
                            ? 'Кликните на цвет — он добавится в выбранный слот'
                            : 'Сначала выберите слот выше'}
                        </p>
                      </div>
                    )}

                    {/* Подсказка по заполненным слотам */}
                    {dominantSlots.some((s) => s !== null) && (
                      <div className="mt-3 text-[11px] text-gray-600">
                        Поиск:{' '}
                        {dominantSlots
                          .map((colorId, index) => {
                            if (!colorId) return null;
                            const colorData = COLOR_PALETTE.find((c) => c.id === colorId);
                            const slotName = index === 0 ? 'доминантный' : index === 1 ? 'вторичный' : `слот ${index + 1}`;
                            return `${slotName} = ${colorData?.label}`;
                          })
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    )}
                  </div>
                )}
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
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-900 disabled:opacity-60"
                  >
                    {loading ? 'Ищем…' : 'Найти'}
                  </button>
                </div>
              </div>

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
                          <div className="min-w-0">
                            <div className="truncate font-medium text-gray-900">
                              {(f.title ?? '').trim() || 'Без названия'}
                            </div>
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
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Картинки</h3>
                    <ul className="space-y-2">
                      {results.images.map((im) => (
                        <li key={im.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-gray-900">
                              {(im.title ?? '').trim() || 'Картинка без названия'}
                            </div>
                            {im.colors?.length ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {im.colors.slice(0, 5).map((c, i) => (
                                  <span
                                    key={c + i}
                                    className="inline-block rounded-full border border-gray-200"
                                    style={{ backgroundColor: c, width: 14, height: 14 }}
                                    title={c}
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <Link href={`/images/${im.id}`} className="ml-3 shrink-0 text-xs font-medium text-blue-600 hover:underline">
                            Открыть
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
