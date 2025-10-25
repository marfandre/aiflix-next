import Image from 'next/image'
import { createClient } from '@/lib/supabase-server'
import type { Film } from '../../_types/media'

export default async function FilmPage({ params }: { params: { id: string } }) {
  const { id } = params

  const supabase = createClient()
  const { data, error } = await supabase
    .from('films')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    throw new Error('Фильм не найден')
  }

  const film = data as Film
  const isVideo = film.media_type === 'video'

  const poster =
    isVideo
      ? (film.playback_id ? `https://image.mux.com/${film.playback_id}/thumbnail.jpg?time=1` : null)
      : (film.image_url ?? null)

  return (
    <main className="mx-auto max-w-4xl p-4">
      <h1 className="text-2xl font-bold">{film.title ?? 'Без названия'}</h1>
      {film.description && (
        <p className="mt-2 text-gray-500">{film.description}</p>
      )}

      <div className="mt-4">
        {isVideo ? (
          <mux-player
            playback-id={film.playback_id ?? undefined}
            stream-type="on-demand"
            metadata-video-title={film.title ?? undefined}
            className="w-full rounded-2xl overflow-hidden"
          />
        ) : poster ? (
          <Image
            src={poster}
            alt={film.title ?? 'Изображение'}
            width={film.image_width ?? 1600}
            height={film.image_height ?? 900}
            className="w-full h-auto rounded-2xl"
          />
        ) : (
          <div className="aspect-video w-full rounded-2xl bg-gray-200" />
        )}
      </div>
    </main>
  )
}
