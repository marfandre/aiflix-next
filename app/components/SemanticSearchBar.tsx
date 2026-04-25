'use client';

import { useState, useRef, useEffect } from 'react';
import { useT } from '@/lib/i18n/I18nProvider';

type SearchResult = {
  id: string;
  media_type: 'image' | 'video';
  similarity: number;
  data: any;
};

type Props = {
  onResults: (results: SearchResult[], query: string) => void;
  onClear: () => void;
  activeTab: 'video' | 'images' | 'all';
};

export default function SemanticSearchBar({ onResults, onClear, activeTab }: Props) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasResults, setHasResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K / Cmd+K для фокуса
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  async function handleSearch() {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('q', q);
      params.set('type', 'all');
      params.set('limit', '40');

      const res = await fetch(`/api/semantic-search?${params.toString()}`);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || t('search.error'));
      }

      const json = await res.json();
      const results: SearchResult[] = json.results ?? [];

      onResults(results, q);
      setHasResults(true);
    } catch (e: any) {
      console.error('semantic search error', e);
      setError(e?.message ?? t('search.error'));
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setQuery('');
    setError(null);
    setHasResults(false);
    onClear();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
    if (e.key === 'Escape') {
      if (hasResults) {
        handleClear();
      } else {
        inputRef.current?.blur();
      }
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="relative">
        {/* Иконка поиска */}
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          {loading ? (
            <svg className="w-5 h-5 text-gray-400 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          )}
        </div>

        {/* Инпут */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('search.placeholder')}
          disabled={loading}
          className="w-full pl-12 pr-24 py-3 rounded-2xl border border-gray-300 bg-white/80 backdrop-blur text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]/50 disabled:opacity-60"
        />

        {/* Правая часть: кнопки */}
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
          {hasResults && (
            <button
              type="button"
              onClick={handleClear}
              className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t('common.reset')}
            </button>
          )}
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#1e3a5f] hover:bg-[#162d4a] rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('common.find')}
          </button>
        </div>
      </div>

      {/* Ошибки и результаты ниже */}

      {/* Ошибка */}
      {error && (
        <p className="mt-1.5 text-center text-xs text-red-500">{error}</p>
      )}

      {/* Результат */}
      {hasResults && !error && (
        <p className="mt-1.5 text-center text-xs text-gray-500">
          {t('search.resultsFor', { q: query })}
        </p>
      )}
    </div>
  );
}
