// app/film/[id]/page.tsx
import { createClient } from '@supabase/supabase-js';
import VideoPlayer from '@/components/VideoPlayer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function FilmPage({ params }: { params: { id: string } }) {
  const { data: film, error } = await supabase
    .from('films')
    .select('title, playback_id')
    .eq('id', params.id)
    .single();

  if (error || !film) {
    return <div className="p-6">Фильм не найден</div>;
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">{film.title || 'Без названия'}</h1>
      <VideoPlayer playbackId={film.playback_id} />
    </main>
  );
}

