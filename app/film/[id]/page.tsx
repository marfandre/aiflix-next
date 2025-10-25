import Image from 'next/image'
import { createClient } from '@/lib/supabase-server'
import type { Film } from '../../_types/media'

export default async function FilmPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('films')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) {
    throw new Error('Фильм не найден')
  }

  const film = data as Film
  const isVideo = film.media_type === 'video'

  // Постер для видео/картинки
  const poster = isVideo
    ? film.playback_id
      ? `https://image.mux.com/${film.playback_id}/thumbnail.jpg?time=1&fit_mode=preserve`
      : null
    : film.image_url ?? null

  return (
    <main>
      <h1 className="text-2xl font-bold">{film.title ?? 'Без названия'}</h1>
      {film.description && (
        <p className="mt-2 text-gray-500">{film.description}</p>
      )}

      <div className="mt-6 mx-auto w-full max-w-3xl">
        {isVideo ? (
          film.playback_id ? (
            <mux-player
              playback-id={film.playback_id}
              stream-type="on-demand"
              metadata-video-title={film.title ?? undefined}
              className="w-full rounded-2xl"
              // фиксируем пропорции и не даём расползаться по высоте
              style={{ aspectRatio: '16 / 9', height: 'auto' }}
            />
          ) : (
            <div className="aspect-video w-full rounded-2xl bg-gray-200" />
          )
        ) : poster ? (
          <Image
            src={poster}
            alt={film.title ?? 'Изображение'}
            width={film.image_width ?? 1600}
            height={film.image_height ?? 900}
            className="h-auto w-full rounded-2xl"
          />
        ) : (
          <div className="aspect-video w-full rounded-2xl bg-gray-200" />
        )}
      </div>
    </main>
  )
}
