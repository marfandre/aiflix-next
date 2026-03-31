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
    <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
      {tags.map(tag => (
        <span key={tag} className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
          {tag}
          <button type="button" onClick={() => remove('tags', tag)} className="ml-0.5 text-gray-400 hover:text-gray-700">×</button>
        </span>
      ))}

      {models.map(key => (
        <span key={key} className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
          {MODEL_OPTIONS[key] ?? key}
          <button type="button" onClick={() => remove('models', key)} className="ml-0.5 text-gray-400 hover:text-gray-700">×</button>
        </span>
      ))}

      {aspect && (
        <span className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
          {aspect}
          <button type="button" onClick={() => remove('aspect')} className="ml-0.5 text-gray-400 hover:text-gray-700">×</button>
        </span>
      )}

      {families.map(id => {
        const hex = COLOR_HEX[id] ?? '#ccc';
        const dark = isDark(hex);
        return (
          <span key={id} className="flex items-center gap-1 rounded-full px-3 py-1 text-xs"
            style={{ backgroundColor: hex, color: dark ? 'white' : '#111', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
            {COLOR_LABELS[id] ?? id}
            <button type="button" onClick={() => remove('families', id)} className="ml-0.5 opacity-70 hover:opacity-100">×</button>
          </span>
        );
      })}

      <button type="button" onClick={clearAll}
        className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600 transition">
        Сбросить ×
      </button>
    </div>
  );
}
