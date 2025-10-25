import { createClient } from '@supabase/supabase-js';
import MediaTabs from '../components/MediaTabs';

// Можно кэшировать список изображений на минуту
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

  // Если вдруг листинг закрыт политиками — покажем пусто, но без «Загрузка…»
  const files = (error ? [] : (data ?? [])) as Obj[];

  // Публичный URL можно собрать без дополнительного запроса
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/uploads`;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <MediaTabs />

      {/* Отступ, чтобы сетка не касалась табов */}
      <div className="mt-6" />

      {files.length === 0 ? (
        <p className="text-center mt-10 text-gray-500">Картинок пока нет</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {files.map((f) => (
            <div key={f.name} className="rounded-2xl overflow-hidden shadow-sm">
              <img
                src={`${base}/${encodeURIComponent(f.name)}`}
                alt={f.name}
                className="w-full h-48 object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
