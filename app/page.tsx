// app/page.tsx
export const dynamic = 'force-dynamic';

import Image from 'next/image';
import Link from 'next/link';
import { supabaseServer } from '../lib/supabase-server';

type FilmRow = {
  id: string;
  title: string | null;
  playback_id: string;   // по БД у тебя он есть
  created_at: string;
};

export default async function Page() {
  const supa = supabaseServer();

  const { data, error } = await supa
    .from('films')
    .select('id, title, playback_id, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('films load error:', error);
    return <div className="p-6 text-red-600">Ошибка загрузки списка фильмов</div>;
  }

  const films = (data ?? []) as FilmRow[];

  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">IOWA</h1>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {films.map((f) => {
          const poster = `https://image.mux.com/${f.playback_id}/thumbnail.jpg?time=1&fit_mode=smartcrop&aspect_ratio=16:9&width=800`;
          return (
            <Link
              key={f.id}
              href={`/film/${f.id}`}
              className="block rounded-xl overflow-hidden border hover:shadow transition"
            >
              <div className="relative w-full aspect-video bg-black">
                <Image
                  src={poster}
                  alt={f.title ?? 'Poster'}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  // если вдруг какой-то PID битый — временно можно раскрыть это:
                  unoptimized
                />
              </div>
              <div className="p-3">
                <div className="font-medium truncate">{f.title ?? 'Без названия'}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
