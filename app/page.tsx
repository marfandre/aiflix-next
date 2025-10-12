// app/page.tsx
import Link from 'next/link';
import { supabaseServer } from '../lib/supabase-server';

export const dynamic = 'force-dynamic';

type FilmRow = {
  id: string;
  title: string | null;
  playback_id: string | null;
  duration_seconds: number | null;
  created_at: string | null;
};

function formatDuration(totalSeconds: number | null) {
  if (totalSeconds == null) return null;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default async function Page() {
  const supa = supabaseServer();

  const { data, error } = await supa
    .from<FilmRow>('films')
    .select('id, title, playback_id, duration_seconds, created_at')
    .not('playback_id', 'is', null)          // показываем только готовые к воспроизведению
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Supabase error (list):', error);
  }

  const films = data ?? [];

  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">IOWA</h1>

      {films.length === 0 ? (
        <div className="text-gray-500">Пока нет фильмов.</div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {films.map((f) => (
            <Link
              key={f.id}
              href={`/film/${f.id}`}
              className="block rounded-lg border hover:shadow-md"
            >
              {/* превью/постер (если появится — вставишь сюда), сейчас просто чёрный блок */}
              <div className="relative bg-black aspect-video" />

              <div className="p-3">
                <div className="font-medium">{f.title ?? 'Без названия'}</div>
                {typeof f.duration_seconds === 'number' && (
                  <div className="text-xs text-gray-500 mt-1">
                    {formatDuration(f.duration_seconds)}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
