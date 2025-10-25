'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ImageFile {
  name: string;
  url: string;
}

export default function ImagesPage() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadImages() {
      setLoading(true);
      const { data, error } = await supabase.storage
        .from('images')
        .list('uploads', { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      const urls =
        data?.map((file) => {
          const { data: pub } = supabase.storage
            .from('images')
            .getPublicUrl(`uploads/${file.name}`);
          return { name: file.name, url: pub.publicUrl };
        }) ?? [];

      setImages(urls);
      setLoading(false);
    }

    loadImages();
  }, []);

  if (loading) return <p className="text-center mt-10">Загрузка...</p>;

  if (images.length === 0)
    return <p className="text-center mt-10 text-gray-500">Картинок пока нет</p>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6 text-center">Картинки</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {images.map((img) => (
          <div key={img.name} className="rounded overflow-hidden shadow-sm">
            <img
              src={img.url}
              alt={img.name}
              className="w-full h-48 object-cover hover:opacity-90 transition"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
