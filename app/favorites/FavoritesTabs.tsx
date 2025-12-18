'use client';

import { useRouter, useSearchParams } from 'next/navigation';

type Tab = 'video' | 'images';

export default function FavoritesTabs() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const currentTab: Tab =
        searchParams.get('t') === 'images' ? 'images' : 'video';

    const changeTab = (next: Tab) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('t', next);
        router.push(`/favorites?${params.toString()}`);
    };

    const baseBtn =
        'px-4 py-1.5 rounded-full text-sm font-medium transition whitespace-nowrap';

    return (
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
    );
}
