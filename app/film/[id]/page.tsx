// aiflix/app/film/[id]/page.tsx
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

type Props = {
  params: { id: string };
  searchParams: { from?: string; u?: string };
};

export default async function FilmPage({ params, searchParams }: Props) {
  const supa = createServerComponentClient({ cookies });

  const { data: film } = await supa
    .from('films')
    .select(
      'id,title,description,playback_id,created_at,model,genres,mood'
    )
    .eq('id', params.id)
    .maybeSingle();

  const backHref =
    searchParams.from === 'profile' && searchParams.u
      ? `/u/${encodeURIComponent(searchParams.u)}?t=video`
      : '/?t=video';

  if (!film) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link href={backHref} className="text-blue-600 hover:underline">
          ← Назад к видео
        </Link>
        <div className="mt-6 text-lg">Видео не найдено</div>
      </div>
    );
  }

  const title = (film.title ?? '').trim() || 'Без названия';

  const poster = film.playback_id
    ? `https://image.mux.com/${film.playback_id}/thumbnail.jpg?time=1`
    : '/placeholder.png';

  const hlsSrc = film.playback_id
    ? `https://stream.mux.com/${film.playback_id}.m3u8`
    : null;

  const mp4Src = film.playback_id
    ? `https://stream.mux.com/${film.playback_id}/medium.mp4`
    : null;

  // ---- Модель ----
  const rawModel = (film as any).model as string | null | undefined;
  const modelKey = rawModel ? rawModel.toLowerCase() : null;

  const MODEL_LABELS: Record<string, string> = {
    sora: 'Sora',
    veo: 'Veo',
    'veo-2': 'Veo 2',
    'veo-3': 'Veo 3',
    'veo-3.1': 'Veo 3.1',
    pika: 'Pika',
    runway: 'Runway',
    kling: 'Kling',
    'gen-3': 'Gen-3',
    midjourney: 'Midjourney',
    sdxl: 'SDXL',
    'sd-xl': 'SDXL',
    dalle: 'DALL·E',
    'dall-e': 'DALL·E',
    flux: 'Flux',
    krea: 'KREA',
  };

  const modelLabel = modelKey ? MODEL_LABELS[modelKey] ?? rawModel ?? null : null;

  // ---- Жанры ----
  const rawGenres = (film as any).genres as string[] | null | undefined;
  const genres: string[] = Array.isArray(rawGenres)
    ? rawGenres.filter((g) => !!g && g.trim().length > 0)
    : [];

  // ---- Атмосфера / настроение ----
  const rawMood = (film as any).mood as string | null | undefined;
  const moodLabel = rawMood ? rawMood.trim() : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href={backHref} className="text-blue-600 hover:underline">
        ← Назад к видео
      </Link>

      <h1 className="mt-4 text-3xl font-bold">{title}</h1>

      {/* Плеер */}
      <div className="mt-6 flex justify-center">
        <div className="w-full max-w-4xl aspect-video overflow-hidden rounded-xl bg-black shadow-lg">
          <video
            controls
            playsInline
            poster={poster}
            className="h-full w-full object-contain"
          >
            {hlsSrc && <source src={hlsSrc} type="application/x-mpegURL" />}
            {mp4Src && <source src={mp4Src} type="video/mp4" />}
            Ваш браузер не поддерживает воспроизведение видео.
          </video>
        </div>
      </div>

      {/* Модель + жанры + атмосфера */}
      {(modelLabel || genres.length > 0 || moodLabel) && (
        <div className="mt-3 space-y-1 text-sm text-gray-600">
          {modelLabel && (
            <p>
              Модель:{' '}
              <span className="font-medium">{modelLabel}</span>
            </p>
          )}

          {(genres.length > 0 || moodLabel) && (
            <p>
              {genres.length > 0 && (
                <>
                  Жанры:{' '}
                  <span className="font-medium">
                    {genres.join(', ')}
                  </span>
                </>
              )}

              {genres.length > 0 && moodLabel && <span className="mx-2">•</span>}

              {moodLabel && (
                <>
                  Атмосфера:{' '}
                  <span className="font-medium">
                    {moodLabel}
                  </span>
                </>
              )}
            </p>
          )}
        </div>
      )}

      {film.description && (
        <p className="mt-4 text-gray-700 whitespace-pre-line">
          {film.description}
        </p>
      )}
    </div>
  );
}
