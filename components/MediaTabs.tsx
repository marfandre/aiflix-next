// aiflix/app/components/MediaTabs.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MediaTabs() {
  const pathname = usePathname();
  const isFilm = pathname?.startsWith('/film');
  const isImages = pathname?.startsWith('/images');

  return (
    <div className="inline-flex rounded-full border overflow-hidden">
      <Link
        href="/film"
        className={
          'px-4 py-2 text-sm ' +
          (isFilm ? 'bg-black text-white' : 'bg-white hover:bg-gray-50')
        }
      >
        Видео
      </Link>
      <Link
        href="/images"
        className={
          'px-4 py-2 text-sm ' +
          (isImages ? 'bg-black text-white' : 'bg-white hover:bg-gray-50')
        }
      >
        Картинки
      </Link>
    </div>
  );
}
