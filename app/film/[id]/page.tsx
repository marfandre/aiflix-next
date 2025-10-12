// app/film/[id]/page.tsx
export const dynamic = 'force-dynamic';

import { supabaseServer } from '@/lib/supabase-server'; // проверь путь

type Film = {
  id: string;
  title: string | null;
  playback_id: string | null;
  duration_seconds: number | null;
  created_at: string | null;
};

export default async function FilmPage({
  params,
}: { params: { id: string } }) {
  const supa = supabaseServer();

  const { data: film, error } = await supa
    .from<Film>('films')
    .select('id, title, playback_id, duration_seconds, created_at')
    .eq('id', params.id)
    .single();

  if (error || !film) {
    return <div className="p-6">Фильм не найден</div>;
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">{film.title ?? 'Без названия'}</h1>
      {film.playback_id ? (
        <div className="aspect-video bg-black">
          <video
            className="w-full h-full"
            controls
            src={`https://stream.mux.com/${film.playback_id}.m3u8`}
          />
        </div>
      ) : (
        <div>Нет playback_id</div>
      )}
    </main>
  );
}
