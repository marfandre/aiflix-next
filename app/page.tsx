// app/page.tsx
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseServer } from '../lib/supabase-server'; // ваш реальный путь!
import Image from 'next/image';

type FilmRow = {
  id: string;
  title: string | null;
  playback_id: string | null;
  duration_seconds: number | null;
  created_at: string;
};

function formatDuration(totalSeconds: number | null) {
  if (!totalSeconds && totalSeconds !== 0) return '';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

export default async function Page() {
  const supa = supabaseServer();

  const { data, error } = await supa
    .from('films')
    .select('id, title, playback_id, duration_seconds, created_at')
    .not('playback_id', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('films load error:', error);
    return <div className="p-6 text-red-600">Ошибка загрузки списка фильмов</div>;
  }

  const films = (data ?? []) as FilmRow[];

  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">IOWA</h1>

      {films.length === 0 && (
        <div className="text-gray-500">Пока нет готовых видео</div>
      )}

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {films.map((f) => {
          const pid = f.playback_id ?? '';
          const posterUrl = pid
            ? `https://image.mux.com/${pid}/thumbnail.jpg?time=1&fit_mode=smartcrop&aspect_ratio=16:9&width=800`
            : '/no-poster.png';

          return (
            <Link
              key={f.id}
              href={`/film/${f.id}`}
              className="block rounded-lg overflow-hidden border hover:shadow"
            >
              <div className="relative bg-black aspect-video">
                <Image
                  src={posterUrl}
                  alt={f.title ?? 'Poster'}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  priority={false}
                />
              </div>
              <div className="p-3">
                <div className="font-medium truncate">{f.title ?? 'Без названия'}</div>
                <div className="text-sm text-gray-500">
                  {formatDuration(f.duration_seconds)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
