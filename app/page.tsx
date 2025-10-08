async function getFilms() {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? ''
  const res = await fetch(`${base}/api/films`, { cache: 'no-store' })
  return (await res.json()).films as any[]
}

export default async function HomePage() {
  const films = await getFilms()
  return (
    <div className="max-w-6xl mx-auto p-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {films?.map((f) => (
        <a key={f.id} href={`/film/${f.id}`} className="block border rounded-2xl p-3 hover:shadow">
          <div className="aspect-video bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
            <span className="text-xs text-gray-500">AI‑Created</span>
          </div>
          <h3 className="font-semibold truncate">{f.title}</h3>
          <p className="text-sm text-gray-500 line-clamp-2">{f.description}</p>
        </a>
      ))}
    </div>
  )
}
