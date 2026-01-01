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

  // Базовые стили — плавный переход 200ms
  const baseBtn =
    'px-5 py-2 rounded-full text-base font-medium transition-all duration-200 ease-out whitespace-nowrap';

  // Активный режим — светлый, "всплывший"
  const activeStyle =
    'bg-white shadow-md text-gray-900';

  // Неактивный режим — просто текст, hover = лёгкий фон + тёмный текст
  const inactiveStyle =
    'bg-transparent text-gray-500 hover:bg-gray-200/50 hover:text-gray-900';

  return (
    <div className="relative w-full flex items-center justify-center">
      {/* Табы — строго по центру */}
      <div className="inline-flex items-center gap-1 rounded-full bg-gray-100 shadow-sm p-1.5">
        <button
          type="button"
          onClick={() => changeTab('video')}
          aria-current={currentTab === 'video' ? 'page' : undefined}
          className={`${baseBtn} ${currentTab === 'video' ? activeStyle : inactiveStyle}`}
        >
          Видео
        </button>

        <button
          type="button"
          onClick={() => changeTab('images')}
          aria-current={currentTab === 'images' ? 'page' : undefined}
          className={`${baseBtn} ${currentTab === 'images' ? activeStyle : inactiveStyle}`}
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
