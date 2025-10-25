'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import MediaTabs from '../components/MediaTabs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ImageFile { name: string; url: string; }

export default function ImagesPage() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadImages() {
      setLoading(true);
      const { data, error } = await supabase.storage
        .from('images')
        .list('uploads', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }
      const urls = (data ?? []).map((f) => {
        const { data: pub } = supabase.storage
          .from('images')
          .getPublicUrl(`uploads/${f.name}`);
        return { name: f.name, url: pub.publicUrl };
      });
      setImages(urls);
      setLoading(false);
    }
    loadImages();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <MediaTabs />

      {/* Отступ, чтобы сетка не касалась табов */}
      <div className="mt-6" />

      {loading && <p className="text-center mt-10">Загрузка…</p>}

      {!loading && images.length === 0 && (
        <p className="text-center mt-10 text-gray-500">Картинок пока нет</p>
      )}

      {!loading && images.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {images.map((img) => (
            <div key={img.name} className="rounded-2xl overflow-hidden shadow-sm">
              <img src={img.url} alt={img.name} className="w-full h-48 object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
