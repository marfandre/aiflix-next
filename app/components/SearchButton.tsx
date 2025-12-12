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
  // Картинки / универсальные
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

  // Видео-фокус (но можно использовать и для поиска картинок, если хочешь)
  'Sora',
  'Pika',
  'Runway',
];
// как отображаемая модель мапится на ключ в БД
const MODEL_SEARCH_KEYS: Record<string, string> = {
  'DALL·E': 'dalle',
  'DALL·E 3': 'dalle',         // если хочешь — можешь сделать 'dalle-3'
  'Midjourney': 'midjourney',
  'Stable Diffusion XL': 'sdxl',
  'Stable Diffusion 3': 'sdxl', // или 'stable-diffusion-3', если так будешь хранить
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



// Подсказки типов изображений/жанров
const IMAGE_TYPE_SUGGESTIONS: string[] = [
  'портрет',
  'пейзаж',
  'cinematic',
  'isometric',
  '3d render',
  'flat illustration',
];

// Подсказки настроений
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

type ColorTab = 'hex' | 'palette' | 'circle';

export default function SearchButton() {
  const [open, setOpen] = useState(false);
  const [includeVideo, setIncludeVideo] = useState(false);
  const [includeImages, setIncludeImages] = useState(false);

  const [genresInput, setGenresInput] = useState('');
  const [colorsInput, setColorsInput] = useState('');

  const [colorTab, setColorTab] = useState<ColorTab>('hex');

  // обычный цветовой поиск (HEX / Палитра)
  const [selectedPaletteColors, setSelectedPaletteColors] = useState<string[]>(
    [],
  );

  // палитра слотов (5 кругов)
  const [slotColors, setSlotColors] = useState<string[]>(
    () => new Array(5).fill(''),
  );
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(
    null,
  );
  const currentSlotColor =
    selectedSlotIndex !== null ? slotColors[selectedSlotIndex] || null : null;

  // новые фильтры
  const [modelInput, setModelInput] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [moodInput, setMoodInput] = useState('');
  const [selectedImageTypes, setSelectedImageTypes] = useState<string[]>([]);

  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [dropdownModelOpen, setDropdownModelOpen] = useState(false);
  const [dropdownImageTypeOpen, setDropdownImageTypeOpen] = useState(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  function setColorForSlot(color: string) {
    if (selectedSlotIndex === null) return;
    setSlotColors((prev) => {
      const next = [...prev];
      next[selectedSlotIndex] = color;
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

    // модель
    if (selectedModels.length) {
  const normalizedModels = selectedModels
    .map((label) => MODEL_SEARCH_KEYS[label] ?? label)
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);

  if (normalizedModels.length) {
    params.set('models', normalizedModels.join(','));
  }
}

    // настроение
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

    // тип изображения
    if (selectedImageTypes.length) {
      params.set(
        'imageTypes',
        selectedImageTypes.map((t) => t.toLowerCase()).join(','),
      );
    }

    // цвета: либо слот, либо свободный ввод
    if (colorTab === 'circle' && selectedSlotIndex !== null && currentSlotColor) {
      params.set('slotIndex', String(selectedSlotIndex));
      params.set('slotColor', currentSlotColor.toLowerCase());
    } else if (colorsInput.trim()) {
      params.set(
        'colors',
        colorsInput
          .split(',')
          .map((c) => c.trim().toLowerCase())
          .filter(Boolean)
          .join(','),
      );
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

  function handlePaletteClick(color: string) {
    const lower = color.toLowerCase();
    const currentLower = selectedPaletteColors.map((c) => c.toLowerCase());
    let next: string[];
    if (currentLower.includes(lower)) {
      next = selectedPaletteColors.filter(
        (c) => c.toLowerCase() !== lower,
      );
    } else {
      next = [...selectedPaletteColors, color];
    }
    syncColorsInputFromPalette(next);
    setColorForSlot(color);
  }

  function syncColorsInputFromPalette(nextPalette: string[]) {
    setSelectedPaletteColors(nextPalette);

    if (!nextPalette.length) {
      setColorsInput('');
      return;
    }

    const hexes = nextPalette.map((c) => c.toLowerCase());
    setColorsInput(hexes.join(', '));
  }

  function renderSlotCircles() {
    const circles = Array.from({ length: 5 }, (_, i) => i);
    return (
      <div className="flex items-center gap-3">
        {circles.map((idx) => {
          const base = 32;
          const step = 4;
          const size = Math.max(16, base - idx * step);
          const isSelected = selectedSlotIndex === idx;
          const fillColor = slotColors[idx] || '#ffffff';

          return (
            <button
              key={idx}
              type="button"
              onClick={() =>
                setSelectedSlotIndex((prev) => (prev === idx ? null : idx))
              }
              className={`relative flex items-center justify-center rounded-full border transition ${
                isSelected
                  ? 'border-gray-900 ring-2 ring-gray-900/40'
                  : 'border-gray-300'
              }`}
              style={{
                width: size,
                height: size,
                backgroundColor: fillColor || '#ffffff',
              }}
            >
              {!fillColor && (
                <span className="text-[10px] text-gray-400">{idx + 1}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  const filteredModelOptions = MODEL_OPTIONS.filter(
    (m) =>
      m.toLowerCase().includes(modelInput.toLowerCase()) &&
      !selectedModels.includes(m),
  );

  const filteredImageTypeOptions = IMAGE_TYPE_SUGGESTIONS.filter(
    (t) =>
      t.toLowerCase().includes('') &&
      !selectedImageTypes.includes(t),
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-full border bg-white px-3 py-1 text-xs font-medium transition hover:border-gray-400 hover:bg-gray-50"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5 text-gray-500"
        >
          <circle
            cx="11"
            cy="11"
            r="5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
          />
          <line
            x1="15.5"
            y1="15.5"
            x2="19"
            y2="19"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 px-4 pt-16">
          <div
            ref={dialogRef}
            className="flex w-full max-w-3xl max-h-[90vh] flex-col rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Поиск по цветам и жанрам
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Настрой фильтры, а мы покажем подходящие видео и картинки.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <span className="sr-only">Закрыть</span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                >
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* переключатель типов */}
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
              {/* Левая колонка: жанры, атмосфера, модель, тип */}
              <div>
                {/* жанры */}
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Жанры
                </label>
                <input
                  type="text"
                  value={genresInput}
                  onChange={(e) => setGenresInput(e.target.value)}
                  placeholder="например: sci-fi, horror"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  Можно несколько, через запятую. Для видео используется поле{' '}
                  <code>genres</code>.
                </p>

                {/* настроение */}
                <div className="mt-4">
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Атмосфера / настроение
                  </label>
                  <input
                    type="text"
                    value={moodInput}
                    onChange={(e) => setMoodInput(e.target.value)}
                    placeholder="например: cozy, gloomy, epic"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-[11px] text-gray-500">
                    Можно перечислить несколько состояний через запятую. Для
                    картинок удобно хранить поле <code>mood</code> в нижнем
                    регистре.
                  </p>

                  {MOOD_SUGGESTIONS.length > 0 && (
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
                  )}
                </div>

                {/* модель */}
                <div className="mt-4">
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Модель (Sora, Midjourney, SDXL, Pika, Flux…)
                  </label>
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
                                setSelectedModels((prev) =>
                                  prev.includes(m) ? prev : [...prev, m],
                                );
                                setModelInput('');
                                setDropdownModelOpen(false);
                              }}
                              className="block w-full px-3 py-1 text-left hover:bg-gray-100"
                            >
                              {m}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-1 text-gray-400">
                            Модель не найдена
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    В таблице <code>images_meta</code> храни <code>model</code>{' '}
                    в нижнем регистре (например, <code>sora</code>,{' '}
                    <code>midjourney</code>, <code>flux</code>).
                  </p>

                  {selectedModels.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selectedModels.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() =>
                            setSelectedModels((prev) =>
                              prev.filter((x) => x !== m),
                            )
                          }
                          className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-800"
                        >
                          <span>{m}</span>
                          <span className="text-gray-500">×</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* тип изображения */}
                <div className="mt-4">
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Тип изображения
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={''}
                      onChange={() => {}}
                      onFocus={() => setDropdownImageTypeOpen(true)}
                      placeholder="например: портрет, пейзаж"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                    {dropdownImageTypeOpen && (
                      <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border bg-white text-xs shadow">
                        {filteredImageTypeOptions.length > 0 ? (
                          filteredImageTypeOptions.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => {
                                setSelectedImageTypes((prev) =>
                                  prev.includes(t) ? prev : [...prev, t],
                                );
                                setDropdownImageTypeOpen(false);
                              }}
                              className="block w-full px-3 py-1 text-left hover:bg-gray-100"
                            >
                              {t}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-1 text-gray-400">
                            Тип не найден
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Для фильтра используется поле <code>image_type</code> в
                    таблице <code>images_meta</code> (в нижнем регистре).
                  </p>

                  {selectedImageTypes.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {selectedImageTypes.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() =>
                            setSelectedImageTypes((prev) =>
                              prev.filter((x) => x !== t),
                            )
                          }
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

              {/* ПРАВАЯ КОЛОНКА: цвета */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Цвета
                </label>

                {/* вкладки HEX / Палитра / Круг */}
                <div className="mb-1 flex border-b text-xs font-medium text-gray-500">
                  {(['hex', 'palette', 'circle'] as ColorTab[]).map((tab) => {
                    const label =
                      tab === 'hex'
                        ? 'HEX'
                        : tab === 'palette'
                        ? 'Палитра'
                        : 'Круг';
                    const active = colorTab === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setColorTab(tab)}
                        className={`relative px-3 pb-1 pt-0.5 ${
                          active ? 'text-black' : 'text-gray-500'
                        }`}
                      >
                        {label}
                        {active && (
                          <span className="absolute inset-x-1 -bottom-[1px] h-[2px] rounded-full bg-black" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* слоты-палитры — те самые 5 кругов */}
                <div className="mt-2">{renderSlotCircles()}</div>

                {colorTab !== 'circle' && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    Круги соответствуют 5 цветам палитры (доминирующий слева).
                    Для точного поиска по одному слоту используйте вкладку
                    «Круг».
                  </p>
                )}

                {/* HEX */}
                {colorTab === 'hex' && (
                  <>
                    <input
                      type="text"
                      value={colorsInput}
                      onChange={(e) => setColorsInput(e.target.value)}
                      placeholder="#043c52, #ff9500"
                      className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                    <p className="mt-1 text-[11px] text-gray-500">
                      Введите один или несколько цветов в формате CSS HEX
                      (например <code>#fad52c</code>), через запятую.
                    </p>
                  </>
                )}

                {/* Палитра */}
                {colorTab === 'palette' && (
                  <div className="mt-2">
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        '#FF3B30',
                        '#FF9500',
                        '#FFCC00',
                        '#34C759',
                        '#32ADE6',
                        '#007AFF',
                        '#5856D6',
                        '#AF52DE',
                        '#FF2D55',
                        '#8E8E93',
                      ].map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handlePaletteClick(color)}
                          className="h-6 w-6 rounded-full border border-gray-300"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-gray-500">
                      Можно выбрать цвета ниже — поле заполняется автоматически.
                    </p>
                  </div>
                )}

                {/* Круг — ты можешь позже доделать рендер кольца,
                    сейчас логика работает через slotColor */}
                {colorTab === 'circle' && (
                  <p className="mt-2 text-[11px] text-gray-500">
                    Выбери слот выше и задай ему цвет (например, из HEX или
                    Палитры). По активному слоту будет идти поиск.
                  </p>
                )}
              </div>
            </div>

            {/* футер модалки */}
            <div className="mt-4 border-t pt-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] text-gray-500">
                  Выбор по цветам и жанрам можно комбинировать.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setGenresInput('');
                      setColorsInput('');
                      setModelInput('');
                      setSelectedModels([]);
                      setMoodInput('');
                      setSelectedImageTypes([]);
                      setSelectedPaletteColors([]);
                      setSlotColors(new Array(5).fill(''));
                      setSelectedSlotIndex(null);
                      setResults(null);
                      setError(null);
                      setIncludeVideo(false);
                      setIncludeImages(false);
                    }}
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
                {results &&
                  !(results.films?.length ?? 0) &&
                  !(results.images?.length ?? 0) && (
                    <p className="text-sm text-gray-500">
                      Ничего не найдено по заданным фильтрам.
                    </p>
                  )}

                {results?.films?.length ? (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Видео
                    </h3>
                    <ul className="space-y-2">
                      {results.films.map((f) => {
                        const title =
                          (f.title ?? '').trim() || 'Без названия (видео)';
                        const genres =
                          (f.genres ?? []).filter(Boolean).join(', ') ||
                          'Жанр не указан';

                        return (
                          <li
                            key={f.id}
                            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium text-gray-900">
                                {title}
                              </div>
                              <div className="mt-0.5 truncate text-[11px] text-gray-500">
                                {genres}
                              </div>
                            </div>
                            <Link
                              href={`/film/${f.id}`}
                              className="ml-3 shrink-0 text-xs font-medium text-blue-600 hover:underline"
                            >
                              Открыть
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                {results?.images?.length ? (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Картинки
                    </h3>
                    <ul className="space-y-2">
                      {results.images.map((im) => {
                        const title =
                          (im.title ?? '').trim() || 'Картинка без названия';
                        const colors = (im.colors ?? []).slice(0, 5);

                        return (
                          <li
                            key={im.id}
                            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium text-gray-900">
                                {title}
                              </div>
                              {!!colors.length && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {colors.map((c, i) => (
                                    <span
                                      key={c + i}
                                      className="inline-block rounded-full border border-gray-200"
                                      style={{
                                        backgroundColor: c,
                                        width: 14,
                                        height: 14,
                                      }}
                                      title={c}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                            <Link
                              href={`/images/${im.id}`}
                              className="ml-3 shrink-0 text-xs font-medium text-blue-600 hover:underline"
                            >
                              Открыть
                            </Link>
                          </li>
                        );
                      })}
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
