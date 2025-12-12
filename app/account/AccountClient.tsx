'use client';

import { useState } from 'react';

type Film = {
  id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  playback_id: string | null;
  upload_id: string | null;
  created_at: string;
};

type ImageMeta = {
  id: string;
  user_id: string;
  path: string;
  title: string | null;
  description: string | null;
  created_at: string;
};

export default function AccountClient({
  initialUsername,
  initialFilms,
  initialImages,
}: {
  initialUsername: string | null;
  initialFilms: Film[];
  initialImages: { meta: ImageMeta; url: string }[];
}) {
  const [username, setUsername] = useState<string | null>(initialUsername);
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  const [films, setFilms] = useState<Film[]>(initialFilms);
  const [images, setImages] = useState<{ meta: ImageMeta; url: string }[]>(initialImages);

  async function saveUsername(next: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/profile/username', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Не удалось сохранить ник');
      setUsername(next);
      setEdit(false);
    } catch (e: any) {
      alert(e?.message || 'Ошибка');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteImage(path: string, id: string) {
    try {
      const res = await fetch('/api/images/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || 'Ошибка удаления');
      }
      setImages((prev) => prev.filter((i) => i.meta.id !== id));
    } catch (e: any) {
      alert(e?.message || 'Не удалось удалить');
    }
  }

  return (
    <div className="max-w-5xl p-6">
      <h1 className="mb-2 text-3xl font-bold">Личный кабинет</h1>

      {/* Никнейм */}
      <div className="mb-8 flex items-center gap-3">
        {!edit ? (
          <>
            <div className="text-lg">
              Ник:{' '}
              <span className="font-semibold">
                {username ?? 'Без ника'}
              </span>
            </div>
            <button
              className="text-sm px-2 py-1 border rounded hover:bg-gray-50"
              onClick={() => setEdit(true)}
              title="Изменить ник"
            >
              ✏️
            </button>
          </>
        ) : (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget as HTMLFormElement;
              const input = form.elements.namedItem('u') as HTMLInputElement;
              saveUsername(input.value.trim());
            }}
          >
            <input
              name="u"
              defaultValue={username ?? ''}
              placeholder="Ваш ник"
              minLength={2}
              maxLength={32}
              className="border rounded px-2 py-1"
            />
            <button
              disabled={saving}
              className="px-3 py-1 border rounded bg-black text-white disabled:opacity-50"
            >
              Сохранить
            </button>
            <button
              type="button"
              className="px-3 py-1 border rounded"
              onClick={() => setEdit(false)}
            >
              Отмена
            </button>
          </form>
        )}
      </div>

      {/* ВИДЕО */}
      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-semibold">Видео</h2>
        {films.length === 0 && <p className="text-gray-600">Пока пусто.</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {films.map((f) => (
            <div key={f.id} className="rounded border p-3">
              <div className="font-medium">{f.title || 'Без названия'}</div>
              <div className="text-sm text-gray-600 mb-2">{f.description}</div>

              {f.playback_id ? (
                <video controls className="w-full rounded" src={`https://stream.mux.com/${f.playback_id}.m3u8`} />
              ) : (
                <div className="text-sm text-orange-600">Обработка…</div>
              )}

              <div className="mt-2 text-xs text-gray-500">
                {new Date(f.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* КАРТИНКИ */}
      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-semibold">Картинки</h2>
        {images.length === 0 && <p className="text-gray-600">Пока пусто.</p>}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map(({ meta, url }) => (
            <figure key={meta.id} className="relative rounded border p-2">
              <button
                type="button"
                title="Удалить"
                onClick={() => handleDeleteImage(meta.path, meta.id)}
                className="absolute right-2 top-2 z-10 rounded bg-white/90 border px-2 py-1 text-xs hover:bg-white"
              >
                🗑
              </button>

              <img
                src={url}
                alt=""
                className="w-full h-40 object-cover rounded"
                onError={() => {
                  // если файла нет — мгновенно уберём из UI
                  setImages((prev) => prev.filter((i) => i.meta.id !== meta.id));
                }}
              />

              <figcaption className="mt-2 text-sm">
                {meta.title || 'Без названия'}
                <div className="text-xs text-gray-500">
                  {new Date(meta.created_at).toLocaleString()}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
