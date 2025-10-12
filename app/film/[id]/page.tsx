// app/film/[id]/page.tsx
import { notFound } from 'next/navigation';
import VideoPlayer from '@/components/VideoPlayer';
import { supabaseServer } from '../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: { id: string };
};

export default async function FilmPage({ params }: PageProps) {
  const supa = supabaseServer();

  const { data: film, error } = await supa
    .from('films')
    .select('id, title, playback_id, description, duration_seconds, created_at')
    .eq('id', params.id)
    .single();

  if (error || !film) {
    // Нет записи в БД → 404
    return notFound();
  }

  // Видео ещё обрабатывается в Mux (webhook ещё не установил playback_id)
  if (!film.playback_id) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">
          {film.title || 'Без названия'}
        </h1>
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
          <p className="text-yellow-800">
            Видео загружено и обрабатывается в Mux. Пожалуйста, обновите страницу
            через пару минут.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">
        {film.title || 'Без названия'}
      </h1>

      {/* Плеер Mux */}
      <div className="relative bg-black aspect-video mb-6">
        <VideoPlayer playbackId={film.playback_id} />
      </div>

      {film.description && (
        <p className="text-gray-600 leading-relaxed">{film.description}</p>
      )}
    </main>
  );
}
