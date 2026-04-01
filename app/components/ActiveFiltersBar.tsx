'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const MODEL_OPTIONS: Record<string, string> = {
  dalle: 'DALL·E', midjourney: 'Midjourney', sdxl: 'SDXL',
  flux: 'Flux', kandinsky: 'Kandinsky', leonardo: 'Leonardo',
  ideogram: 'Ideogram', playground: 'Playground', sora: 'Sora',
  pika: 'Pika', runway: 'Runway',
};

const COLOR_LABELS: Record<string, string> = {
  red: 'Красный', orange: 'Оранжевый', yellow: 'Жёлтый', green: 'Зелёный',
  teal: 'Бирюзовый', cyan: 'Голубой', blue: 'Синий', indigo: 'Индиго',
  purple: 'Фиолетовый', pink: 'Розовый', brown: 'Коричневый',
  black: 'Чёрный', white: 'Белый',
};

const COLOR_HEX: Record<string, string> = {
  red: '#FF1744', orange: '#FF6D00', yellow: '#FFEA00', green: '#00E676',
  teal: '#1DE9B6', cyan: '#00E5FF', blue: '#2979FF', indigo: '#651FFF',
  purple: '#D500F9', pink: '#FF4081', brown: '#8D6E63',
  black: '#121212', white: '#FAFAFA',
};

const ASPECT_OPTIONS = [
  { value: '1:1', label: '1:1 — Квадрат' },
  { value: '16:9', label: '16:9 — Широкий' },
  { value: '9:16', label: '9:16 — Вертикаль' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3' },
  { value: '21:9', label: '21:9 — Ультраширокий' },
];

/* ---- Единая капсула: ⊕ Категория  Значение1 × Значение2 × ---- */
function FilterCapsule({ label, items, options, onRemove, onAdd }: {
  label: string;
  items: { key: string; label: string; hex?: string }[];
  options: { value: string; label: string; hex?: string }[];
  onRemove: (key: string) => void;
  onAdd: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    o.value.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      {/* Одна общая капсула */}
      <span className="inline-flex items-center rounded-full border border-gray-200 bg-white text-xs overflow-hidden">
        {/* Левая часть: ⊕ + название категории (кликабельная) */}
        <button
          type="button"
          onClick={() => { if (options.length > 0) { setOpen(!open); setSearch(''); } }}
          className={`flex items-center gap-1 px-2.5 py-1 text-gray-400 transition ${options.length > 0 ? 'hover:text-gray-600 cursor-pointer' : 'cursor-default'}`}
        >
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="8" cy="8" r="7" />
            <path d="M8 5v6M5 8h6" />
          </svg>
          <span className="text-gray-500">{label}</span>
        </button>

        {/* Правая часть: значения с × */}
        {items.map((item) => (
          <span key={item.key} className="flex items-center gap-1 px-2.5 py-1 text-gray-700 border-l border-gray-200">
            {item.hex && (
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-gray-200" style={{ backgroundColor: item.hex }} />
            )}
            {item.label}
            <button type="button" onClick={() => onRemove(item.key)} className="text-gray-400 hover:text-gray-700 leading-none ml-0.5">×</button>
          </span>
        ))}
      </span>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[180px]">
          {options.length > 5 && (
            <div className="p-1.5">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск..."
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-gray-400"
                autoFocus
              />
            </div>
          )}
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-400">Ничего не найдено</div>
            )}
            {filtered.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onAdd(o.value); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 flex items-center gap-2"
              >
                {o.hex && (
                  <span className="w-3 h-3 rounded-full inline-block flex-shrink-0 border border-gray-200" style={{ backgroundColor: o.hex }} />
                )}
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ActiveFiltersBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tags = searchParams.get('tags')?.split(',').filter(Boolean) ?? [];
  const models = searchParams.get('models')?.split(',').filter(Boolean) ?? [];
  const aspect = searchParams.get('aspect') ?? '';
  const families = searchParams.get('families')?.split(',').filter(Boolean) ?? [];

  const hasFilters = tags.length > 0 || models.length > 0 || aspect || families.length > 0;
  if (!hasFilters) return null;

  function remove(key: string, value?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      params.delete(key);
    } else {
      const current = params.get(key)?.split(',').filter(Boolean) ?? [];
      const next = current.filter(v => v !== value);
      if (next.length) params.set(key, next.join(','));
      else params.delete(key);
    }
    router.push(`/?${params.toString()}`);
  }

  function add(key: string, value: string, replace?: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (replace) {
      params.set(key, value);
    } else {
      const current = params.get(key)?.split(',').filter(Boolean) ?? [];
      if (current.includes(value)) return;
      current.push(value);
      params.set(key, current.join(','));
    }
    router.push(`/?${params.toString()}`);
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    ['tags', 'models', 'aspect', 'families', 'colors'].forEach(k => params.delete(k));
    router.push(`/?${params.toString()}`);
  }

  const availableModels = Object.entries(MODEL_OPTIONS)
    .filter(([key]) => !models.includes(key))
    .map(([key, label]) => ({ value: key, label }));

  const availableColors = Object.entries(COLOR_LABELS)
    .filter(([key]) => !families.includes(key))
    .map(([key, label]) => ({ value: key, label, hex: COLOR_HEX[key] }));

  const availableAspects = ASPECT_OPTIONS
    .filter(o => o.value !== aspect)
    .map(o => ({ value: o.value, label: o.label }));

  const allModels = Object.entries(MODEL_OPTIONS).map(([key, label]) => ({ value: key, label }));
  const allColors = Object.entries(COLOR_LABELS).map(([key, label]) => ({ value: key, label, hex: COLOR_HEX[key] }));
  const allAspects = ASPECT_OPTIONS.map(o => ({ value: o.value, label: o.label }));

  return (
    <div className="flex items-center justify-center gap-2 px-4 pb-4">
      <FilterCapsule
        label="Модель"
        items={models.map(key => ({ key, label: MODEL_OPTIONS[key] ?? key }))}
        options={availableModels.length > 0 ? availableModels : allModels.filter(m => !models.includes(m.value))}
        onRemove={(key) => remove('models', key)}
        onAdd={(v) => add('models', v)}
      />

      <FilterCapsule
        label="Формат"
        items={aspect ? [{ key: aspect, label: aspect }] : []}
        options={aspect ? availableAspects : allAspects}
        onRemove={() => remove('aspect')}
        onAdd={(v) => add('aspect', v, true)}
      />

      <FilterCapsule
        label="Цвет"
        items={families.map(id => ({ key: id, label: COLOR_LABELS[id] ?? id, hex: COLOR_HEX[id] }))}
        options={availableColors.length > 0 ? availableColors : allColors.filter(c => !families.includes(c.value))}
        onRemove={(key) => remove('families', key)}
        onAdd={(v) => add('families', v)}
      />

      {tags.length > 0 && (
        <FilterCapsule
          label="Теги"
          items={tags.map(tag => ({ key: tag, label: tag }))}
          options={[]}
          onRemove={(key) => remove('tags', key)}
          onAdd={() => {}}
        />
      )}

      <button type="button" onClick={clearAll}
        className="ml-1 text-gray-300 hover:text-gray-500 transition" title="Сбросить все фильтры">
        <svg viewBox="0 0 24 24" className="h-4 w-4"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}
