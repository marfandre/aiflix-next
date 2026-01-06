'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState, useEffect } from 'react';
import SearchButton from './SearchButton';
import ColorSearchButton from './ColorSearchButton';

type Tab = 'video' | 'images';

export default function MediaTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentTab: Tab =
    searchParams.get('t') === 'images' ? 'images' : 'video';

  // Рефы для кнопок чтобы измерить их позицию
  const videoRef = useRef<HTMLButtonElement>(null);
  const imagesRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Состояние для позиции и размера индикатора
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  // Обновить позицию индикатора при изменении таба
  useEffect(() => {
    const activeRef = currentTab === 'video' ? videoRef : imagesRef;
    if (activeRef.current && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const buttonRect = activeRef.current.getBoundingClientRect();
      setIndicatorStyle({
        left: buttonRect.left - containerRect.left,
        width: buttonRect.width,
      });
    }
  }, [currentTab]);

  const changeTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('t', next);
    router.push(`/?${params.toString()}`);
  };

  // Базовые стили кнопок
  const baseBtn =
    'relative z-10 px-5 py-2 rounded-full text-base font-medium transition-colors duration-200 ease-out whitespace-nowrap';

  return (
    <div className="relative w-full flex items-center justify-center">
      {/* Табы — строго по центру */}
      <div
        ref={containerRef}
        className="relative inline-flex items-center gap-1 rounded-full bg-gray-100 shadow-sm p-1.5"
      >
        {/* Анимированный индикатор (ходунок) */}
        <div
          className="absolute top-1.5 bottom-1.5 rounded-full bg-white shadow-md transition-all duration-300 ease-out"
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
        />

        <button
          ref={videoRef}
          type="button"
          onClick={() => changeTab('video')}
          aria-current={currentTab === 'video' ? 'page' : undefined}
          className={`${baseBtn} ${currentTab === 'video' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
        >
          Видео
        </button>

        <button
          ref={imagesRef}
          type="button"
          onClick={() => changeTab('images')}
          aria-current={currentTab === 'images' ? 'page' : undefined}
          className={`${baseBtn} ${currentTab === 'images' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
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
