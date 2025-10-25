// app/upload/page.tsx
'use client';

import { useState } from 'react';

type Kind = 'video' | 'image';

export default function UploadPage() {
  const [kind, setKind] = useState<Kind>('video');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept =
    kind === 'video'
      ? 'video/mp4,video/webm'
      : 'image/jpeg,image/png,image/webp';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setError(null);

    try {
      const form = new FormData();
      form.append('media_type', kind);      // 'video' | 'image'
      form.append('file', file);            // сам файл
      form.append('title', title);          // можно пусто
      form.append('description', description); // можно пусто

      // Если у вас другой маршрут — поменяйте ниже путь:
      const res = await fetch('/api/upload', { method: 'POST', body: form });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Upload failed');
      }

      // после успешной загрузки — сбрасываем форму
      setTitle('');
      setDescription('');
      setFile(null);
      // при необходимости можно перейти на главную:
      // window.location.href = '/';
    } catch (err: any) {
      setError(err.message ?? 'Ошибка загрузки');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      {/* Заголовок */}
      <h1 className="text-center text-3xl font-semibold tracking-tight">Загрузка</h1>

      {/* Табы */}
      <div className="mt-6 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setKind('video')}
          className={
            'rounded-full px-4 py-2 text-sm transition ' +
            (kind === 'video'
              ? 'bg-neutral-900 text-white'
              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200')
          }
        >
          Видео
        </button>
        <button
          type="button"
          onClick={() => setKind('image')}
          className={
            'rounded-full px-4 py-2 text-sm transition ' +
            (kind === 'image'
              ? 'bg-neutral-900 text-white'
              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200')
          }
        >
          Картинка
        </button>
      </div>

      {/* Форма */}
      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        {/* Название */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-800">
            Название
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            placeholder="Введите название (можно оставить пустым)"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none ring-0 transition focus:border-neutral-400"
          />
        </div>

        {/* Описание */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-800">
            Описание
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            placeholder="Короткое описание (можно оставить пустым)"
            rows={5}
            className="w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none ring-0 transition focus:border-neutral-400"
          />
        </div>

        {/* Файл */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-800">
            Файл {kind === 'video' ? '(MP4/WEBM)' : '(JPG/PNG/WebP)'}
          </label>
          <input
            type="file"
            accept={accept}
            onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-white hover:file:bg-neutral-800"
          />
        </div>

        {/* Ошибка */}
        {error && (
          <p className="text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Кнопка */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!file || submitting}
            className={
              'rounded-lg px-5 py-2 text-sm font-medium transition ' +
              (!file || submitting
                ? 'cursor-not-allowed bg-neutral-200 text-neutral-500'
                : 'bg-neutral-900 text-white hover:bg-neutral-800')
            }
          >
            {submitting ? 'Загрузка…' : 'Загрузить'}
          </button>
        </div>
      </form>

      {/* Подвал */}
      <footer className="mt-14 text-center text-xs text-neutral-500">
        © 2025 IOWA
      </footer>
    </div>
  );
}
