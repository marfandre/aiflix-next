'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useT } from '@/lib/i18n/I18nProvider';

type SavedPrompt = {
  id: string;
  prompt: string;
  negative_prompt: string | null;
  model: string | null;
  seed: string | null;
  aspect_ratio: string | null;
  params: Record<string, unknown> | null;
  source_type: 'film' | 'image' | null;
  source_id: string | null;
  note: string | null;
  created_at: string;
};

type SavedPalette = {
  id: string;
  colors: string[];
  title: string | null;
  source_type: 'film' | 'image' | null;
  source_id: string | null;
  created_at: string;
};

type Tab = 'prompts' | 'palettes';

export default function SavedPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('prompts');
  const [prompts, setPrompts] = useState<SavedPrompt[] | null>(null);
  const [palettes, setPalettes] = useState<SavedPalette[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [p, pl] = await Promise.all([
          fetch('/api/saved-prompts').then((r) => r.json()),
          fetch('/api/saved-palettes').then((r) => r.json()),
        ]);
        if (p.error) throw new Error(p.error);
        if (pl.error) throw new Error(pl.error);
        setPrompts(p.items ?? []);
        setPalettes(pl.items ?? []);
      } catch (e: any) {
        setError(e?.message ?? t('saved.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function deletePrompt(id: string) {
    if (!confirm(t('saved.confirmDeletePrompt'))) return;
    const res = await fetch(`/api/saved-prompts/${id}`, { method: 'DELETE' });
    if (res.ok) setPrompts((prev) => (prev ?? []).filter((x) => x.id !== id));
  }

  async function deletePalette(id: string) {
    if (!confirm(t('saved.confirmDeletePalette'))) return;
    const res = await fetch(`/api/saved-palettes/${id}`, { method: 'DELETE' });
    if (res.ok) setPalettes((prev) => (prev ?? []).filter((x) => x.id !== id));
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{t('saved.title')}</h1>

      {/* Табы */}
      <div className="mb-6 flex gap-2 border-b">
        <button
          onClick={() => setTab('prompts')}
          className={`px-4 py-2 text-sm font-medium transition ${
            tab === 'prompts'
              ? 'border-b-2 border-black text-black'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('saved.prompts')} {prompts ? `(${prompts.length})` : ''}
        </button>
        <button
          onClick={() => setTab('palettes')}
          className={`px-4 py-2 text-sm font-medium transition ${
            tab === 'palettes'
              ? 'border-b-2 border-black text-black'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('saved.palettes')} {palettes ? `(${palettes.length})` : ''}
        </button>
      </div>

      {loading && <div className="text-sm text-gray-500">{t('common.loading')}</div>}
      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {!loading && !error && tab === 'prompts' && (
        <PromptsList items={prompts ?? []} onDelete={deletePrompt} />
      )}
      {!loading && !error && tab === 'palettes' && (
        <PalettesList items={palettes ?? []} onDelete={deletePalette} />
      )}
    </div>
  );
}

function PromptsList({ items, onDelete }: { items: SavedPrompt[]; onDelete: (id: string) => void }) {
  const t = useT();
  if (items.length === 0) {
    return <div className="text-sm text-gray-500">{t('saved.empty')}</div>;
  }
  return (
    <div className="space-y-4">
      {items.map((p) => (
        <div key={p.id} className="rounded-xl border bg-white p-4">
          <div className="mb-2 flex items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {p.model && <span className="rounded bg-gray-100 px-2 py-0.5">{p.model}</span>}
              {p.aspect_ratio && <span className="rounded bg-gray-100 px-2 py-0.5">{p.aspect_ratio}</span>}
              {p.seed && <span className="rounded bg-gray-100 px-2 py-0.5">seed: {p.seed}</span>}
              {p.source_type && p.source_id && (
                <Link
                  href={p.source_type === 'film' ? `/film/${p.source_id}` : `/images/${p.source_id}`}
                  className="text-blue-600 hover:underline"
                >
                  {t('saved.source')}
                </Link>
              )}
            </div>
            <button
              onClick={() => onDelete(p.id)}
              className="text-xs text-gray-400 hover:text-red-600"
              aria-label={t('common.delete')}
            >
              {t('common.delete')}
            </button>
          </div>

          <div className="whitespace-pre-wrap text-sm text-gray-900">{p.prompt}</div>

          {p.negative_prompt && (
            <div className="mt-3 border-t pt-3">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">Negative</div>
              <div className="whitespace-pre-wrap text-sm text-gray-700">{p.negative_prompt}</div>
            </div>
          )}

          {p.note && (
            <div className="mt-3 rounded bg-yellow-50 p-2 text-sm text-gray-700">{p.note}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function PalettesList({ items, onDelete }: { items: SavedPalette[]; onDelete: (id: string) => void }) {
  const t = useT();
  if (items.length === 0) {
    return <div className="text-sm text-gray-500">{t('saved.empty')}</div>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
      {items.map((p) => (
        <div key={p.id} className="overflow-hidden rounded-xl border bg-white">
          <div className="flex h-24 w-full">
            {p.colors.map((c, i) => (
              <div
                key={`${p.id}-${i}`}
                className="flex-1"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          <div className="p-3">
            <div className="mb-2 flex flex-wrap gap-1">
              {p.colors.map((c, i) => (
                <span key={`${p.id}-hex-${i}`} className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-700">
                  {c}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              {p.source_type && p.source_id ? (
                <Link
                  href={p.source_type === 'film' ? `/film/${p.source_id}` : `/images/${p.source_id}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {t('saved.source')}
                </Link>
              ) : (
                <span className="text-xs text-gray-400">{p.title ?? ''}</span>
              )}
              <button
                onClick={() => onDelete(p.id)}
                className="text-xs text-gray-400 hover:text-red-600"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
