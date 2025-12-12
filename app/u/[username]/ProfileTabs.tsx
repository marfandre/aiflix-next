'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type Tab = 'video' | 'images';

export default function ProfileTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current: Tab = (searchParams.get('t') === 'images' ? 'images' : 'video');

  function setTab(tab: Tab) {
    const sp = new URLSearchParams(searchParams);
    if (tab === 'video') sp.delete('t');
    else sp.set('t', 'images');
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  return (
    <div className="inline-flex items-center rounded-full bg-gray-100 p-1 ring-1 ring-gray-200">
      <button
        onClick={() => setTab('video')}
        className={`rounded-full px-4 py-1.5 text-sm transition
          ${current === 'video' ? 'bg-white font-semibold shadow' : 'text-gray-700 hover:text-black'}`}
        aria-current={current === 'video' ? 'page' : undefined}
      >
        Видео
      </button>
      <button
        onClick={() => setTab('images')}
        className={`rounded-full px-4 py-1.5 text-sm transition
          ${current === 'images' ? 'bg-white font-semibold shadow' : 'text-gray-700 hover:text-black'}`}
        aria-current={current === 'images' ? 'page' : undefined}
      >
        Картинки
      </button>
    </div>
  );
}
