import { createClient } from '@supabase/supabase-js';
import VideoPlayer from '@/components/VideoPlayer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function FilmPage({ params }: { params: { id: string } }) {
  const { data: film } = await supabase
    .from('films')
    .select('*')
    .eq('id', params.id)
    .single();

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">{film?.title ?? 'Видео'}</h1>

      {film?.playback_id ? (
        <VideoPlayer playbackId={film.playback_id} title={film.title ?? ''} />
      ) : (
        <p className="text-gray-500">
          Видео ещё обрабатывается... Обновите страницу позже.
        </p>
      )}
    </main>
  );
}
