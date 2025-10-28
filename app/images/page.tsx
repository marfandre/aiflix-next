import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import MediaTabs from '../components/MediaTabs';

export const revalidate = 60;

type Obj = { name: string };

export default async function ImagesPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .storage
    .from('images')
    .list('uploads', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

  const files = (error ? [] : (data ?? [])) as Obj[];
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/uploads`;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <MediaTabs />
      <div className="mt-6" />

      {files.length === 0 ? (
        <p className="text-center mt-10 text-gray-500">Картинок пока нет</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {files.map((f) => {
            const href = `/images/${encodeURIComponent(f.name)}`;
            const url = `${base}/${encodeURIComponent(f.name)}`;
            return (
              <Link
                key={f.name}
                href={href}
                className="block overflow-hidden shadow-sm hover:shadow-md transition"
              >
                <img
                  src={url}
                  alt={f.name}
                  className="w-full h-48 object-cover rounded-none"
                  loading="lazy"
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
