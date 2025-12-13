'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

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

const MOOD_SUGGESTIONS: string[] = [
  'cozy',
  'gloomy',
  'epic',
  'dark',
  'bright',
  'dreamy',
  'noir',
  'gritty',
];

const IMAGE_TYPE_SUGGESTIONS: string[] = [
  'портрет',
  'пейзаж',
  'cinematic',
  'isometric',
  '3d render',
  'flat illustration',
];

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

type ColorSearchMode = 'simple' | 'dominant';

export default function SearchButton() {
  const [open, setOpen] = useState(false);
  const [includeVideo, setIncludeVideo] = useState(false);
  const [includeImages, setIncludeImages] = useState(false);

  const [genresInput, setGenresInput] = useState('');

  // === ЦВЕТОВОЙ ПОИСК ===
  const [colorSearchMode, setColorSearchMode] = useState<ColorSearchMode>('simple');
  
  // Простой режим: массив выбранных цветов (bucket id)
  const [simpleSelectedColors, setSimpleSelectedColors] = useState<string[]>([]);
  
  // Режим по доминантности: 5 слотов
  const [dominantSlots, setDominantSlots] = useState<(string | null)[]>([null, null, null, null, null]);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);

  // Модели
  const [modelInput, setModelInput] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [dropdownModelOpen, setDropdownModelOpen] = useState(false);

  // Настроение
  const [moodInput, setMoodInput] = useState('');

  // Тип изображения
  const [selectedImageTypes, setSelectedImageTypes] = useState<string[]>([]);
  const [dropdownImageTypeOpen, setDropdownImageTypeOpen] = useState(false);

  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement | null>(null);

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

    // Жанры
    if (genresInput.trim()) {
      params.set(
        'genres',
        genresInput
          .split(',')
          .map((g) => g.trim().toLowerCase())
          .filter(Boolean)
          .join(','),
      );
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

    // Настроение
    if (moodInput.trim()) {
      params.set(
        'moods',
        moodInput
          .split(',')
          .map((m) => m.trim().toLowerCase())
          .filter(Boolean)
          .join(','),
      );
    }

    // Тип изображения
    if (selectedImageTypes.length) {
      params.set('imageTypes', selectedImageTypes.map((t) => t.toLowerCase()).join(','));
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
    setGenresInput('');
    setModelInput('');
    setSelectedModels([]);
    setMoodInput('');
    setSelectedImageTypes([]);
    setSimpleSelectedColors([]);
    setDominantSlots([null, null, null, null, null]);
    setActiveSlotIndex(null);
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

  const filteredImageTypeOptions = IMAGE_TYPE_SUGGESTIONS.filter(
    (t) => !selectedImageTypes.includes(t),
  );

  // Размеры слотов для режима доминантности (убывающие)
  const SLOT_SIZES = [36, 30, 26, 22, 18];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-full border bg-white px-3 py-1 text-xs font-medium transition hover:border-gray-400 hover:bg-gray-50"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 text-gray-500">
          <circle cx="11" cy="11" r="5.5" fill="none" stroke="currentColor" strokeWidth="2.1" />
          <line x1="15.5" y1="15.5" x2="19" y2="19" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
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
                className={`flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-medium transition ${
                  includeVideo
                    ? 'border-gray-900 text-gray-900 ring-2 ring-gray-900/70'
                    : 'border-gray-200 text-gray-500'
                }`}
              >
                Видео
              </button>
              <button
                type="button"
                onClick={() => setIncludeImages((v) => !v)}
                className={`flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-medium transition ${
                  includeImages
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
                {/* Жанры */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Жанры</label>
                  <input
                    type="text"
                    value={genresInput}
                    onChange={(e) => setGenresInput(e.target.value)}
                    placeholder="например: sci-fi, horror"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>

                {/* Настроение */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Атмосфера / настроение</label>
                  <input
                    type="text"
                    value={moodInput}
                    onChange={(e) => setMoodInput(e.target.value)}
                    placeholder="например: cozy, gloomy, epic"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                  <div className="mt-2 flex flex-wrap gap-1">
                    {MOOD_SUGGESTIONS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMoodInput(m)}
                        className="rounded-full border border-gray-200 px-2 py-1 text-[11px] text-gray-700 hover:border-gray-400"
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Модель */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Модель</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={modelInput}
                      onChange={(e) => setModelInput(e.target.value)}
                      onFocus={() => setDropdownModelOpen(true)}
                      placeholder="начните вводить название модели"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
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
                              className="block w-full px-3 py-1 text-left hover:bg-gray-100"
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
                  {selectedModels.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selectedModels.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setSelectedModels((prev) => prev.filter((x) => x !== m))}
                          className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-800"
                        >
                          <span>{m}</span>
                          <span className="text-gray-500">×</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Тип изображения */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Тип изображения</label>
                  <div className="relative">
                    <input
                      type="text"
                      onFocus={() => setDropdownImageTypeOpen(true)}
                      placeholder="например: портрет, пейзаж"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      readOnly
                    />
                    {dropdownImageTypeOpen && (
                      <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border bg-white text-xs shadow">
                        {filteredImageTypeOptions.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              setSelectedImageTypes((prev) => [...prev, t]);
                              setDropdownImageTypeOpen(false);
                            }}
                            className="block w-full px-3 py-1 text-left hover:bg-gray-100"
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedImageTypes.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {selectedImageTypes.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSelectedImageTypes((prev) => prev.filter((x) => x !== t))}
                          className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-800"
                        >
                          <span>{t}</span>
                          <span className="text-gray-500">×</span>
                        </button>
                      ))}
                    </div>
                  )}
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
                    className={`relative px-3 pb-2 pt-1 ${
                      colorSearchMode === 'simple' ? 'text-black' : 'text-gray-500'
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
                    className={`relative px-3 pb-2 pt-1 ${
                      colorSearchMode === 'dominant' ? 'text-black' : 'text-gray-500'
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
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PALETTE.map((color) => {
                        const isSelected = simpleSelectedColors.includes(color.id);
                        return (
                          <button
                            key={color.id}
                            type="button"
                            onClick={() => handleSimpleColorClick(color.id)}
                            className={`h-8 w-8 rounded-full border-2 transition ${
                              isSelected
                                ? 'border-gray-900 ring-2 ring-gray-900/40'
                                : 'border-gray-200 hover:border-gray-400'
                            }`}
                            style={{ backgroundColor: color.hex }}
                            title={color.label}
                          />
                        );
                      })}
                    </div>
                    {simpleSelectedColors.length > 0 && (
                      <div className="mt-2 text-[11px] text-gray-600">
                        Выбрано: {simpleSelectedColors.map((id) => COLOR_PALETTE.find((c) => c.id === id)?.label).join(', ')}
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
                          <button
                            key={index}
                            type="button"
                            onClick={() => setActiveSlotIndex(isActive ? null : index)}
                            className={`flex items-center justify-center rounded-full border-2 transition ${
                              isActive
                                ? 'border-gray-900 ring-2 ring-gray-900/40'
                                : 'border-gray-300'
                            }`}
                            style={{
                              width: size,
                              height: size,
                              backgroundColor: colorData?.hex || '#f3f4f6',
                            }}
                            title={`Слот ${index + 1}${colorData ? `: ${colorData.label}` : ''}`}
                          >
                            {!colorData && (
                              <span className="text-[9px] text-gray-400">{index + 1}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Палитра для выбора (показывается когда выбран слот) */}
                    {activeSlotIndex !== null && (
                      <div className="rounded-lg border bg-gray-50 p-3">
                        <div className="mb-2 text-[11px] font-medium text-gray-600">
                          Выберите цвет для слота {activeSlotIndex + 1}
                          {activeSlotIndex === 0 && ' (доминантный)'}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {COLOR_PALETTE.map((color) => {
                            const isSelected = dominantSlots[activeSlotIndex] === color.id;
                            return (
                              <button
                                key={color.id}
                                type="button"
                                onClick={() => handleDominantColorClick(color.id)}
                                className={`h-7 w-7 rounded-full border-2 transition ${
                                  isSelected
                                    ? 'border-gray-900 ring-2 ring-gray-900/40'
                                    : 'border-gray-200 hover:border-gray-400'
                                }`}
                                style={{ backgroundColor: color.hex }}
                                title={color.label}
                              />
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setDominantSlots((prev) => {
                              const next = [...prev];
                              next[activeSlotIndex] = null;
                              return next;
                            });
                          }}
                          className="mt-2 text-[11px] text-gray-500 hover:text-gray-700"
                        >
                          Очистить слот
                        </button>
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
