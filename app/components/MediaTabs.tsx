'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import SearchButton from './SearchButton';
import ColorSearchButton from './ColorSearchButton';

type Tab = 'video' | 'images';

export default function MediaTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentTab: Tab =
    searchParams.get('t') === 'images' ? 'images' : 'video';

  const changeTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('t', next);
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="relative w-full flex items-center justify-center">
      {/* Табы — строго по центру */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => changeTab('video')}
          aria-current={currentTab === 'video' ? 'page' : undefined}
          className={`px-4 py-1.5 rounded-full text-base font-medium transition-all duration-200 ${currentTab === 'video'
            ? 'text-[#1e3a5f] ring-1 ring-[#1e3a5f]'
            : 'text-gray-400 hover:text-gray-600 hover:ring-1 hover:ring-gray-300'
            }`}
        >
          Видео
        </button>

        <button
          type="button"
          onClick={() => changeTab('images')}
          aria-current={currentTab === 'images' ? 'page' : undefined}
          className={`px-4 py-1.5 rounded-full text-base font-medium transition-all duration-200 ${currentTab === 'images'
            ? 'text-[#1e3a5f] ring-1 ring-[#1e3a5f]'
            : 'text-gray-400 hover:text-gray-600 hover:ring-1 hover:ring-gray-300'
            }`}
        >
          Картинки
        </button>
      </div>

      {/* Кнопки поиска — рядом с табами */}
      <div className="flex items-center gap-2 ml-3">
        <SearchButton />
        <ColorSearchButton />
      </div>
    </div>
  );
}

