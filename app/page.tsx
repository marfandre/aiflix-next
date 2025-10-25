'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import MediaTabs from './components/MediaTabs';

// Клиент для браузера (публичные ключи)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Film = {
  id: string;
  title: string | null;
  description: string | null;
  playback_id: string | null;  // из Mux
  created_at?: string | null;
};

export default function HomePage() {
  const [videos, setVideos] = useState<Film[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Берём только готовые к просмотру ролики
      const { data, error } = await supabase
        .from('films')
        .select('id,title,description,playback_id,created_at')
        .not('playback_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(24);

      if (!error && data) setVideos(data as Film[]);
      setLoading(false);
    }

    load();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Переключатель «Видео / Картинки» */}
      <MediaTabs />

      <h1 className="text-2xl font-semibold mb-6 text-center">Видео</h1>

      {loading && <p className="text-center mt-10">Загрузка…</p>}

      {!loading && videos.length === 0 && (
        <p className="text-center mt-10 text-gray-500">
          Видео пока нет или ещё обрабатываются.
        </p>
      )}

      {!loading && videos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {videos.map((v) => {
            // превью от Mux (если playback_id есть)
            const thumb = v.playback_id
              ? `https://image.mux.com/${v.playback_id}/thumbnail.jpg`
              : '/placeholder.jpg';

            return (
              <Link
                key={v.id}
                href={`/film/${v.id}`}
                className="block rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition"
              >
                <div className="aspect-video bg-gray-100">
                  <img
                    src={thumb}
                    alt={v.title ?? 'Видео'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-3">
                  <div className="font-medium truncate">{v.title || 'Без названия'}</div>
                  {v.description && (
                    <div className="text-sm text-gray-500 line-clamp-2">{v.description}</div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
