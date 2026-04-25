'use client';

import { useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import SemanticSearchBar from './SemanticSearchBar';
import MediaTabs from './MediaTabs';
import ImageFeedClient from './ImageFeedClient';
import VideoFeedClient from './VideoFeedClient';
import ActiveFiltersBar from './ActiveFiltersBar';
import type { ImageRow } from './image-feed/types';
import type { VideoRow } from './video-feed/types';
import { useT } from '@/lib/i18n/I18nProvider';

type SearchResult = {
  id: string;
  media_type: 'image' | 'video';
  similarity: number;
  data: any;
};

type Props = {
  userId: string | null;
  searchParams?: {
    colors?: string;
    families?: string;
    models?: string;
    moods?: string;
    imageTypes?: string;
    tags?: string;
    aspect?: string;
  };
};

const SEMANTIC_SEARCH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_SEMANTIC_SEARCH === '1';

export default function HomeContent({ userId, searchParams }: Props) {
  const sp = useSearchParams();
  const tab = sp.get('t') === 'images' ? 'images' : 'video';
  const t = useT();

  const [searchImages, setSearchImages] = useState<ImageRow[] | null>(null);
  const [searchVideos, setSearchVideos] = useState<VideoRow[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedKey, setFeedKey] = useState(0);

  // Поиск всегда по всему контенту (all)
  const handleResults = useCallback((results: SearchResult[], query: string) => {
    const images: ImageRow[] = results
      .filter((r) => r.media_type === 'image' && r.data)
      .map((r) => ({ ...r.data, profiles: r.data.profiles ?? null }));

    const videos: VideoRow[] = results
      .filter((r) => r.media_type === 'video' && r.data)
      .map((r) => ({ ...r.data, profiles: r.data.profiles ?? null }));

    setSearchImages(images);
    setSearchVideos(videos);
    setSearchQuery(query);
  }, []);

  const handleClear = useCallback(() => {
    setSearchImages(null);
    setSearchVideos(null);
    setSearchQuery('');
    setFeedKey((k) => k + 1);
  }, []);

  const isSearchActive = searchImages !== null || searchVideos !== null;

  return (
    <>
      {/* Логотип → Поиск → Табы */}
      <div className="w-full">
        {/* Логотип */}
        <div className="mb-1 flex justify-center" style={{ marginTop: '-8px' }}>
          <Link href="/" className="block transition-opacity hover:opacity-80">
            <img
              src="/logo.png"
              alt="Waiva"
              style={{ width: '484px', height: 'auto', objectFit: 'contain' }}
            />
          </Link>
        </div>

        {/* Поисковая строка — между логотипом и табами.
            Скрыта если NEXT_PUBLIC_ENABLE_SEMANTIC_SEARCH !== '1' (prod деплой). */}
        {SEMANTIC_SEARCH_ENABLED && (
          <div className="px-4 mb-3" style={{ marginTop: '-30px' }}>
            <SemanticSearchBar
              onResults={handleResults}
              onClear={handleClear}
              activeTab="all"
            />
          </div>
        )}

        {/* Табы */}
        <div className="flex justify-center" style={{ marginBottom: '20px' }}>
          <MediaTabs />
        </div>
      </div>

      {/* Контент */}
      <div className="mx-auto max-w-[2000px] px-4">
        {tab === 'video' && (
          isSearchActive ? (
            searchVideos && searchVideos.length > 0 ? (
              <VideoFeedClient
                key={`search-v-${searchQuery}`}
                userId={userId}
                initialVideos={searchVideos}
              />
            ) : (
              <div className="text-center py-20 text-gray-400">
                {t('search.noVideos', { q: searchQuery })}
                {searchImages && searchImages.length > 0 && (
                  <span className="block mt-2 text-gray-500">
                    {t('search.foundImagesSwitch', { n: searchImages.length })}
                  </span>
                )}
              </div>
            )
          ) : (
            <VideoFeedClient key={`feed-v-${feedKey}`} userId={userId} />
          )
        )}

        {tab === 'images' && !isSearchActive && <ActiveFiltersBar />}

        {tab === 'images' && (
          isSearchActive ? (
            searchImages && searchImages.length > 0 ? (
              <ImageFeedClient
                key={`search-i-${searchQuery}`}
                userId={userId}
                initialImages={searchImages}
              />
            ) : (
              <div className="text-center py-20 text-gray-400">
                {t('search.noImages', { q: searchQuery })}
                {searchVideos && searchVideos.length > 0 && (
                  <span className="block mt-2 text-gray-500">
                    {t('search.foundVideosSwitch', { n: searchVideos.length })}
                  </span>
                )}
              </div>
            )
          ) : (
            <ImageFeedClient
              key={`feed-i-${feedKey}`}
              userId={userId}
              searchParams={searchParams}
            />
          )
        )}
      </div>
    </>
  );
}
