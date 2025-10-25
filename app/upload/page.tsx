'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function UploadPage() {
  const [type, setType] = useState<'video' | 'image'>('video');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!file) {
      setError('Выберите файл');
      return;
    }

    try {
      setIsLoading(true);

      if (type === 'video') {
        // ---- ВИДЕО (MUX) ----
        const startRes = await fetch('/api/videos/start', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: title?.trim() || null,
            description: description?.trim() || null,
            kind: 'video',
          }),
        });
        if (!startRes.ok) {
          const data = await startRes.json().catch(() => ({}));
          throw new Error(data?.error || `Start failed: ${startRes.status}`);
        }
        const { upload_url } = await startRes.json();
        const putRes = await fetch(upload_url, {
          method: 'PUT',
          headers: { 'content-type': file.type || 'video/mp4' },
          body: file,
        });
        if (!putRes.ok) throw new Error(`Mux direct upload failed: ${putRes.status}`);

        setSuccess('Видео принято. Обработка началась.');
      } else {
        // ---- КАРТИНКА (SUPABASE STORAGE) ----
        // 1) Запрашиваем токен и путь для подписанной загрузки
        const startRes = await fetch('/api/images/start', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: title?.trim() || null,
            description: description?.trim() || null,
            filename: file.name, // ВАЖНО: передаём имя файла
          }),
        });
        if (!startRes.ok) {
          const data = await startRes.json().catch(() => ({}));
          throw new Error(data?.error || `Start failed: ${startRes.status}`);
        }
        const { bucket, path, token } = await startRes.json();

        // 2) Загружаем файл по подписанному токену
        const { error: upErr } = await supabase
          .storage
          .from(bucket)
          .uploadToSignedUrl(path, token, file, {
            contentType: file.type || 'image/jpeg',
            upsert: true,
          });

        if (upErr) throw new Error(`Upload to storage failed: ${upErr.message}`);

        setSuccess('Картинка загружена!');
      }

      // сбрасываем форму
      setTitle('');
      setDescription('');
      setFile(null);
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Загрузка</h1>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setType('video')}
          className={`px-4 py-2 rounded ${type === 'video' ? 'bg-black text-white' : 'bg-gray-100'}`}
        >
          Видео
        </button>
        <button
          type="button"
          onClick={() => setType('image')}
          className={`px-4 py-2 rounded ${type === 'image' ? 'bg-black text-white' : 'bg-gray-100'}`}
        >
          Картинка
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Название</label>
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="можно оставить пустым"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Описание</label>
          <textarea
            className="w-full border rounded px-3 py-2 h-28"
            placeholder="короткое описание (можно пустым)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">
            Файл ({type === 'video' ? 'MP4/WEBM' : 'PNG/JPG'})
          </label>
          <input
            type="file"
            accept={type === 'video' ? 'video/mp4,video/webm' : 'image/png,image/jpeg,image/jpg'}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">{success}</p>}

        <button
          type="submit"
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? 'Загрузка…' : 'Загрузить'}
        </button>
      </form>
    </div>
  );
}
