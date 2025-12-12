// aiflix/app/film/page.tsx
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import MediaTabs from '../components/MediaTabs';

export const revalidate = 60;

type Row = {
  id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  playback_id: string | null;
  created_at: string;
  profiles: { username: string | null } | null;
};

function muxPoster(playback_id: string | null) {
  if (!playback_id) return '/placeholder.png';
  return `https://image.mux.com/${playback_id}/thumbnail.jpg?time=1`;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

  const { data, error } = await supabase
    .from('films')
    .select('id,user_id,title,description,playback_id,created_at,profiles:profiles(username)')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) console.error('films list error:', error);

  const rows: Row[] = (data ?? []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    title: r.title ?? null,
    description: r.description ?? null,
    playback_id: r.playback_id ?? null,
    created_at: r.created_at,
    profiles: Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles ?? null,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <MediaTabs />

      {!rows.length ? (
        <div className="mt-8 text-center text-gray-600">Нет видео</div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const title = r.title?.trim() || 'Без названия';
            const nick = r.profiles?.username || 'Гость';
            const dateStr = new Date(r.created_at).toLocaleDateString();

            return (
              <div
                key={r.id}
                className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100"
              >
                <Link href={`/film/${r.id}`} className="block">
                  <div className="relative aspect-video bg-black">
                    <img
                      src={muxPoster(r.playback_id)}
                      alt={title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                </Link>

                {/* Чистая белая панель без любых оверлеев/градиентов */}
                <div className="px-4 py-3">
                  <Link href={`/film/${r.id}`} className="block font-semibold">
                    {title}
                  </Link>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-700">👤 {nick}</span>
                    <span className="text-xs text-gray-500">{dateStr}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
