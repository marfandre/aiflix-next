'use client';

import { useRef, useState, useEffect } from 'react';

type StartResponse = {
  film_id: string;
  upload_id: string;
  upload_url: string;
};

type FilmRow = {
  id: string;
  title: string;
  status: string | null;
  playback_id: string | null;
};

export default function UploadPage() {
  const [title, setTitle] = useState('Untitled');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [step, setStep] = useState<'idle' | 'starting' | 'uploading' | 'processing' | 'ready' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string>('');
  const [filmId, setFilmId] = useState<string>('');
  const [playbackId, setPlaybackId] = useState<string>('');

  const inputRef = useRef<HTMLInputElement | null>(null);

  // ————————————————————————————————————————
  // 1) стартуем direct upload + создаём запись в films
  // ————————————————————————————————————————
  async function startUpload(): Promise<StartResponse> {
    setStep('starting');
    setMessage('Создаём upload в Mux…');

    const res = await fetch('/api/videos/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    });
    if (!res.ok) {
      throw new Error(`/api/videos/start → ${res.status}`);
    }
    return res.json();
  }

  // ————————————————————————————————————————
  // 2) грузим файл на upload_url с прогрессом (XHR)
  // ————————————————————————————————————————
  async function putToMux(uploadUrl: string, f: File) {
    setStep('uploading');
    setMessage('Загрузка файла в Mux…');

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', f.type || 'application/octet-stream');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const p = Math.round((e.loaded / e.total) * 100);
          setProgress(p);
        }
      };

      xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`PUT ${xhr.status} ${xhr.responseText ?? ''}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('XHR network error'));
      xhr.send(f);
    });
  }

  // ————————————————————————————————————————
  // 3) ждём, пока вебхук допишет playback_id (poll)
  // ————————————————————————————————————————
  async function waitPlaybackId(filmId: string, { timeoutMs = 120_000, intervalMs = 3000 } = {}) {
    setStep('processing');
    setMessage('Обработка на Mux… ждём playback_id');

    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const res = await fetch(`/api/films?id=${encodeURIComponent(filmId)}`);
      if (res.ok) {
        const json = (await res.json()) as { films?: FilmRow[] };
        const row = json.films?.[0];
        if (row?.playback_id) {
          setPlaybackId(row.playback_id);
          setStep('ready');
          setMessage('Готово!');
          return;
        }
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error('Не дождались playback_id (timeout)');
  }

  // ————————————————————————————————————————
  // submit
  // ————————————————————————————————————————
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setMessage('Выбери файл');
      inputRef.current?.focus();
      return;
    }
    try {
      setMessage('');
      const start = await startUpload();
      setFilmId(start.film_id);
      await putToMux(start.upload_url, file);
      await waitPlaybackId(start.film_id);
    } catch (err: any) {
      setStep('error');
      setMessage(err?.message || 'Ошибка загрузки');
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Загрузить видео</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Название</label>
          <input
            className="w-full rounded border px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название фильма"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Описание</label>
          <textarea
            className="w-full rounded border px-3 py-2"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Необязательное описание"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Видео-файл</label>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="w-full"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <button
          type="submit"
          className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
          disabled={step === 'starting' || step === 'uploading' || step === 'processing'}
        >
          {step === 'starting'
            ? 'Создаём upload…'
            : step === 'uploading'
            ? `Загрузка… ${progress}%`
            : step === 'processing'
            ? 'Обработка…'
            : 'Загрузить'}
        </button>
      </form>

      {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}

      {step === 'ready' && playbackId && (
        <div className="mt-6 space-y-2">
          <p className="text-green-700">Видео готово! 🎉</p>
          <p className="text-sm">
            Film ID: <code className="bg-gray-100 px-1">{filmId}</code>
          </p>
          <p className="text-sm">
            Playback ID: <code className="bg-gray-100 px-1">{playbackId}</code>
          </p>
          <a
            href={`/film/${filmId}`}
            className="inline-block mt-2 rounded bg-gray-900 text-white px-3 py-2"
          >
            Открыть страницу фильма
          </a>
        </div>
      )}
    </div>
  );
}
