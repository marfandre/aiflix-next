import { notFound } from 'next/navigation'

async function getFilm(id: string) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? ''
  const res = await fetch(`${base}/api/films?id=${id}`, { cache: 'no-store' })
  const json = await res.json()
  return (json.films ?? []).find((x: any) => x.id === id)
}

export default async function FilmPage({ params }: { params: { id: string } }) {
  const film = await getFilm(params.id)
  if (!film) return notFound()

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">{film.title}</h1>
      {film.playback_id ? (
        <video
          controls
          className="w-full rounded-lg"
          src={`https://stream.mux.com/${film.playback_id}.m3u8`}
          playsInline
        />
      ) : (
        <div className="p-6 bg-yellow-50 border rounded">Видео ещё обрабатывается… Обновите страницу позже.</div>
      )}
      <p className="text-gray-600 whitespace-pre-line">{film.description}</p>
    </div>
  )
}
