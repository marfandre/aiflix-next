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

    // если хочешь чистить фильтры при переходе на видео — раскомментируй:
    // if (next === 'video') {
    //   params.delete('colors');
    //   params.delete('models');
    //   params.delete('moods');
    //   params.delete('imageTypes');
    // }

    router.push(`/?${params.toString()}`);
  };

  const baseBtn =
    'px-4 py-1.5 rounded-full text-sm font-medium transition whitespace-nowrap';

  return (
    <div className="w-full flex items-center justify-center gap-3">
      <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => changeTab('video')}
          aria-current={currentTab === 'video' ? 'page' : undefined}
          className={
            baseBtn +
            (currentTab === 'video'
              ? ' bg-white shadow-sm text-gray-900'
              : ' text-gray-700 hover:text-gray-900')
          }
        >
          Видео
        </button>

        <button
          type="button"
          onClick={() => changeTab('images')}
          aria-current={currentTab === 'images' ? 'page' : undefined}
          className={
            baseBtn +
            (currentTab === 'images'
              ? ' bg-white shadow-sm text-gray-900'
              : ' text-gray-700 hover:text-gray-900')
          }
        >
          Картинки
        </button>
      </div>

      {/* Блок с кнопками поиска */}
      <div className="flex items-center gap-2">
        <SearchButton />
        <ColorSearchButton />
      </div>
    </div>
  );
}
