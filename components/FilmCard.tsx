'use client';

import Image from 'next/image';
import Link from 'next/link';

type Props = {
  id: string;
  title: string;
  // у тебя где-то может быть playbackId или playback_id — поддержим оба варианта
  playbackId?: string | null;
  playback_id?: string | null;
};

export default function FilmCard({ id, title, playbackId, playback_id }: Props) {
  const pid = playbackId ?? playback_id ?? ''; // безопасно возьмём любой из вариантов
  const posterUrl = pid
    ? `https://image.mux.com/${pid}/thumbnail.jpg?time=1&fit_mode=smartcrop&aspect_ratio=16:9&width=800`
    : '/no-poster.png'; // резерв на всякий случай

  return (
    <Link
      href={`/films/${id}`}
      className="block rounded-xl overflow-hidden shadow hover:shadow-lg transition"
    >
      <div className="relative w-full aspect-video bg-black">
        <Image
          src={posterUrl}
          alt={title || 'Preview'}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 33vw"
          priority={false}
        />
      </div>
      <div className="p-2 text-sm font-medium">{title}</div>
    </Link>
  );
}
