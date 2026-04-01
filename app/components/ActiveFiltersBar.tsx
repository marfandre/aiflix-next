'use client';

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

function isDark(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 160;
}

function Pill({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700">
      {children}
      <button type="button" onClick={onRemove} className="text-gray-400 hover:text-gray-700 leading-none">×</button>
    </span>
  );
}

function ColorPill({ hex, label, onRemove }: { hex: string; label: string; onRemove: () => void }) {
  const dark = isDark(hex);
  return (
    <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border"
      style={{ backgroundColor: hex, color: dark ? 'white' : '#111', borderColor: dark ? 'transparent' : '#e5e7eb' }}>
      {label}
      <button type="button" onClick={onRemove} className="opacity-60 hover:opacity-100 leading-none">×</button>
    </span>
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

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    ['tags', 'models', 'aspect', 'families', 'colors'].forEach(k => params.delete(k));
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="flex items-center justify-center gap-3 px-4 pb-4">
      {/* Категории слева от пилюль */}
      {tags.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 mr-0.5">Теги</span>
          {tags.map(tag => (
            <Pill key={tag} onRemove={() => remove('tags', tag)}>{tag}</Pill>
          ))}
        </div>
      )}

      {models.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 mr-0.5">Модель</span>
          {models.map(key => (
            <Pill key={key} onRemove={() => remove('models', key)}>{MODEL_OPTIONS[key] ?? key}</Pill>
          ))}
        </div>
      )}

      {aspect && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 mr-0.5">Формат</span>
          <Pill onRemove={() => remove('aspect')}>{aspect}</Pill>
        </div>
      )}

      {families.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 mr-0.5">Цвет</span>
          {families.map(id => (
            <ColorPill key={id} hex={COLOR_HEX[id] ?? '#ccc'} label={COLOR_LABELS[id] ?? id} onRemove={() => remove('families', id)} />
          ))}
        </div>
      )}

      {/* Сбросить */}
      <button type="button" onClick={clearAll}
        className="ml-1 text-gray-300 hover:text-gray-500 transition" title="Сбросить все фильтры">
        <svg viewBox="0 0 24 24" className="h-4 w-4"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}
