'use client';

import Image from 'next/image';
import Link from 'next/link';

type AnyFilm = {
  id: string;
  title?: string | null;
  // поддержим разные возможные поля
  playbackId?: string | null;
  playback_id?: string | null;
  mux_playback_id?: string | null;
  mux?: { playback_id?: string | null; playbackId?: string | null } | null;
};

function resolvePlaybackId(f: AnyFilm): string | null {
  return (
    f.playbackId ??
    f.playback_id ??
    f.mux_playback_id ??
    f.mux?.playback_id ??
    f.mux?.playbackId ??
    null
  );
}

export default function FilmCard(film: AnyFilm) {
  const pid = resolvePlaybackId(film);
  const posterUrl = pid
    ? `https://image.mux.com/${pid}/thumbnail.jpg?time=1&fit_mode=smartcrop&aspect_ratio=16:9&width=800`
    : '/no-poster.png';

  return (
    <Link
      href={`/film/${film.id}`}
      className="block rounded-xl overflow-hidden border hover:shadow transition"
    >
      <div className="relative w-full aspect-video bg-black">
        <Image
          src={posterUrl}
          alt={film.title ?? 'Poster'}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          // если thumbnail вдруг не доступен — покажем заглушку
          onError={(e) => {
            const img = e.currentTarget as unknown as HTMLImageElement & { src: string };
            img.src = '/no-poster.png';
          }}
          priority={false}
        />
      </div>
      <div className="p-3">
        <div className="font-medium truncate">{film.title ?? 'Без названия'}</div>
      </div>
    </Link>
  );
}
