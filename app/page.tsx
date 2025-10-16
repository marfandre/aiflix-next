// app/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { unstable_noStore as noStore } from 'next/cache';
import Link from 'next/link';
import Image from 'next/image';
import { supabaseServer } from '../lib/supabase-server';

type FilmRow = { id: string; title: string | null; playback_id: string | null; created_at: string };

export default async function Page() {
  noStore(); // жёстко отключаем кеширование этой страницы

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
          const poster = f.playback_id
            ? `https://image.mux.com/${f.playback_id}/thumbnail.jpg?time=2&fit_mode=crop&aspect_ratio=16:9&width=800&height=450`
            : '/no-poster.png';
          return (
            <Link key={f.id} href={`/film/${f.id}`} className="block rounded-xl overflow-hidden border hover:shadow transition">
              <div className="relative w-full aspect-video bg-black">
                <Image src={poster} alt={f.title ?? 'Poster'} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
              </div>
              <div className="p-3"><div className="font-medium truncate">{f.title ?? 'Без названия'}</div></div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
