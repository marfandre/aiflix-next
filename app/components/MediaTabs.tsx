'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MediaTabs() {
  const pathname = usePathname();
  const isImages = pathname.startsWith('/images');

  return (
    <div className="w-full flex justify-center">
      <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 p-1">
        <Link
          href="/"
          aria-current={!isImages ? 'page' : undefined}
          className={[
            'px-4 py-1.5 rounded-full text-sm font-medium transition',
            !isImages
              ? 'bg-white shadow-sm text-gray-900'
              : 'text-gray-700 hover:text-gray-900',
          ].join(' ')}
        >
          Видео
        </Link>
        <Link
          href="/images"
          aria-current={isImages ? 'page' : undefined}
          className={[
            'px-4 py-1.5 rounded-full text-sm font-medium transition',
            isImages
              ? 'bg-white shadow-sm text-gray-900'
              : 'text-gray-700 hover:text-gray-900',
          ].join(' ')}
        >
          Картинки
        </Link>
      </div>
    </div>
  );
}
