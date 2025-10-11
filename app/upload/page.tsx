'use client';
import { useState } from 'react';

export default function UploadPage() {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState('');

  async function handleUpload() {
    try {
      if (!file) { setMsg('Выбери файл'); return; }

      // 1) создаём фильм + Direct Upload в Mux
      const r1 = await fetch('/api/videos/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title || 'Untitled', description: '' })
      });
      const j1 = await r1.json();
      if (!r1.ok) throw new Error(j1.error || 'start failed');

      const { upload_url } = j1;
      setMsg('Загружаю файл в Mux...');

      // 2) грузим файл на upload_url
      const r2 = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file
      });
      if (!r2.ok) throw new Error('PUT upload failed');

      setMsg('Файл загружен. Ждём обработку Mux… (10–60 сек)');
    } catch (e:any) {
      setMsg('Ошибка: ' + (e.message || e));
    }
  }

  return (
    <main className="max-w-xl mx-auto p-6 space-y-3">
      <h1 className="text-2xl font-semibold">Загрузка</h1>
      <input className="border p-2 w-full" placeholder="Название"
             value={title} onChange={e => setTitle(e.target.value)} />
      <input type="file" accept="video/*"
             onChange={e => setFile(e.target.files?.[0] || null)} />
      <button className="px-4 py-2 bg-black text-white rounded" onClick={handleUpload}>
        Загрузить
      </button>
      <p className="text-sm text-gray-500">{msg}</p>
    </main>
  );
}

