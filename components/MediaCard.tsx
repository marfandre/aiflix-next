import Image from 'next/image'
import Link from 'next/link'
import type { Film } from '../app/_types/media'

export default function MediaCard({ item }: { item: Film }) {
  // Определяем постер для видео/картинки
  const poster =
    item.media_type === 'video'
      ? (item.playback_id
          ? `https://image.mux.com/${item.playback_id}/thumbnail.jpg?time=1&fit_mode=preserve`
          : null)
      : (item.image_url ?? null)

  // Фолбэки, чтобы <Image> всегда получал строки
  const imgSrc =
  poster ??
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
  const alt = item.title ?? 'Без названия'

  return (
    <Link href={`/film/${item.id}`} className="block rounded-xl overflow-hidden group">
      <div className="relative aspect-video bg-black/10">
        <Image
          src={imgSrc}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition group-hover:scale-[1.02]"
        />
      </div>
      <div className="mt-2 line-clamp-1">{alt}</div>
    </Link>
  )
}
