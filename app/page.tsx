// app/page.tsx
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { getBaseUrl } from '@/lib/getBaseUrl';

export const revalidate = 0;            // отключаем кэш страницы
export const dynamic = 'force-dynamic'; // форсим свежие данные

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Film = {
  id: string;
  title: string | null;
  playback_id: string | null;
  created_at: string | null;
};

export default async function Home() {
  const { data, error } = await supabase
    .from('films')
    .select('id,title,playback_id,created_at')
    .not('playback_id', 'is', null)              // берём только готовые видео
    .order('created_at', { ascending: false })   // новые сверху
    .limit(50);

  if (error) {
    console.error(error);
    return (
      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">IOWA</h1>
        <p className="text-red-600">Ошибка загрузки фильмов: {error.message}</p>
      </main>
    );
  }

  const films = (data ?? []) as Film[];
  const base = getBaseUrl();

  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">AIFLIX</h1>

      <ul className="space-y-3">
        {films.length > 0 ? (
          films.map(f => (
            <li key={f.id} className="border rounded p-3 hover:bg-gray-50">
              {/* если у тебя страница фильма по пути /film/[id], оставь как ниже.
                 если /films/[id] — поменяй путь на `/films/${f.id}` */}
              <Link href={`/film/${f.id}`}>{f.title || 'Без названия'}</Link>
            </li>
          ))
        ) : (
          <li className="text-gray-500">Пока нет фильмов</li>
        )}
      </ul>

      <p className="mt-4 text-xs text-gray-500">Base URL: {base}</p>
      <p className="mt-1 text-xs text-gray-500">Всего: {films.length}</p>
    </main>
  );
}

