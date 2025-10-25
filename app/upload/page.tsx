'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/**
 * Вкладка загрузки видео/картинок.
 * - Кнопка активна, когда выбран файл и не идёт загрузка
 * - Название необязательно: отправляем title || "Без названия"
 * - Видео: запрашиваем signed URL на /api/videos/start и PUT'им файл
 * - Картинка: кладём в Supabase Storage "images/" и создаём запись в films
 */
export default function UploadPage() {
  const supabase = createClientComponentClient();
  const [tab, setTab] = useState<'video' | 'image'>('video');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canSubmit = !!file && !uploading; // название не требуется

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setMessage(null);

    const titleToSend = title.trim() || 'Без названия';

    try {
      if (tab === 'video') {
        // 1) Берём pre-signed URL (или directUpload URL) на бэке
        const start = await fetch('/api/videos/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            title: titleToSend,
            description: description || null,
          }),
        });

        if (!start.ok) {
          const t = await start.text();
          throw new Error(`Не удалось начать загрузку видео: ${t}`);
        }

        const { url } = (await start.json()) as { url: string };

        // 2) Отправляем файл на выданный URL
        const put = await fetch(url, { method: 'PUT', body: file });
        if (!put.ok) {
          const t = await put.text();
          throw new Error(`Ошибка PUT на URL загрузки: ${t}`);
        }

        setMessage('Видео отправлено. Индексация может занять немного времени.');
        // опционально: router.push('/')

      } else {
        // -------- КАРТИНКА --------
        // 1) грузим в Supabase Storage
        const userId =
          (await supabase.auth.getUser()).data.user?.id ?? 'anon';
        const ext = file.name.split('.').pop() ?? 'jpg';
        const path = `${userId}/${Date.now()}.${ext}`;

        const up = await supabase.storage
          .from('images')
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          });

        if (up.error) throw up.error;

        // публичный URL (если бакет public). Если не public — можно получить signed URL.
        const { data: publicUrlData } = supabase.storage
          .from('images')
          .getPublicUrl(path);

        const imageUrl = publicUrlData.publicUrl;

        // 2) считаем размеры изображения (для удобства отображения)
        const dims = await getImageSize(file);

        // 3) создаём запись в films
        const { error: insErr } = await supabase.from('films').insert({
          title: titleToSend,
          description: description || null,
          media_type: 'image',
          image_url: imageUrl,
          image_width: dims?.width ?? null,
          image_height: dims?.height ?? null,
          visibility: 'public',
        });

        if (insErr) throw insErr;

        setMessage('Картинка загружена.');
        // опционально: router.push('/')
      }

      // очистим форму
      setTitle('');
      setDescription('');
      setFile(null);
    } catch (err: any) {
      console.error(err);
      setMessage(err?.message ?? 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-3xl font-bold">Загрузка</h1>

      <div className="mb-6 flex gap-2">
        <button
          type="button"
          onClick={() => setTab('video')}
          className={`rounded-full px-4 py-1 text-sm ${
            tab === 'video'
              ? 'bg-black text-white'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          Видео
        </button>
        <button
          type="button"
          onClick={() => setTab('image')}
          className={`rounded-full px-4 py-1 text-sm ${
            tab === 'image'
              ? 'bg-black text-white'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          Картинка
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium">Название</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Необязательно — подставим «Без названия»"
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="w-full resize-y rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Файл {tab === 'video' ? '(MP4/WebM)' : '(PNG/JPG/WebP)'}
          </label>
          <input
            type="file"
            accept={tab === 'video' ? 'video/mp4,video/webm' : 'image/*'}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className={`rounded px-4 py-2 text-white ${
            canSubmit ? 'bg-black hover:bg-zinc-800' : 'bg-gray-400'
          }`}
        >
          {uploading ? 'Загружаю…' : 'Загрузить'}
        </button>

        {message && (
          <p className="text-sm text-gray-700">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}

/** Получить размеры картинки из File */
async function getImageSize(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = url;
    });
    URL.revokeObjectURL(url);
    return size;
  } catch {
    return null;
  }
}
