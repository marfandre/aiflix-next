'use client';

import { useState } from 'react';

export default function VibrantTestPage() {
  const [fileName, setFileName] = useState('');
  const [colors, setColors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setColors([]);
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/palette', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? `API error ${res.status}`);
      }

      setColors(data.colors ?? []);
    } catch (err: any) {
      console.error('vibrant-test /api/palette error:', err);
      setError(err?.message ?? 'Ошибка при запросе палитры');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Vibrant тест</h1>

      <input type="file" accept="image/*" onChange={handleFileChange} />
      {fileName && (
        <div className="mt-2 text-sm text-gray-500">Выбран файл: {fileName}</div>
      )}

      {loading && <div className="mt-4 text-gray-500">Считаем палитру…</div>}
      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      {colors.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-medium mb-2">Цвета от Vibrant (сервер):</h2>
          <div className="flex gap-4 flex-wrap">
            {colors.map((hex) => (
              <div key={hex} className="flex flex-col items-center text-xs">
                <div
                  className="w-10 h-10 rounded-full border"
                  style={{ backgroundColor: hex }}
                />
                <span className="mt-1">{hex}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
