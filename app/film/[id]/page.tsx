// app/film/[id]/page.tsx
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import VideoPlayer from '@/components/VideoPlayer';

type Film = {
  id: string;
  title: string | null;
  playback_id: string | null;
  duration_seconds: number | null;
  created_at: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function FilmPage({ params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('films') // <-- без дженерика
    .select('id, title, playback_id, duration_seconds, created_at')
    .eq('id', params.id)
    .single();

  if (error || !data) {
    return <div className="p-6">Фильм не найден</div>;
  }

  const film = data as Film;

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">
        {film.title || 'Без названия'}
      </h1>

      {/* playback_id гарантирован на этом роуте */}
      {film.playback_id ? (
        <VideoPlayer playbackId={film.playback_id} />
      ) : (
        <div className="text-gray-500">Видео ещё обрабатывается…</div>
      )}
    </main>
  );
}
