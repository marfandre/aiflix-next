// app/page.tsx
// Гарантируем отсутствие кэша
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import Link from "next/link";
// ВАЖНО: путь под себя. Если файл лежит в /app/lib/supabase-server.ts, то так:
import { supabaseServer } from "./lib/supabase-server";

type Film = {
  id: string;
  title: string | null;
  playback_id: string | null;
  duration_seconds: number | null;
  created_at: string | null;
};

// Хелпер для формата длительности
function formatDuration(totalSeconds?: number | null) {
  if (!totalSeconds && totalSeconds !== 0) return "";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function Page() {
  const supa = supabaseServer();

  // Берём только ролики с playback_id, чтобы «черные»/незавершённые вообще не попадали
  const { data: films, error } = await supa
    .from("films")
    .select("id, title, playback_id, duration_seconds, created_at")
    .not("playback_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Supabase error:", error);
    return <div className="p-6 text-red-600">Ошибка загрузки фильмов</div>;
  }

  const items = films ?? [];

  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">IOWA</h1>

      {items.length === 0 && (
        <p className="text-gray-500">Видео пока нет. Загрузите первый ролик.</p>
      )}

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((f) => {
          const poster = f.playback_id
            ? // превью от Mux (если временно недоступно — будет фолбэк ниже)
              `https://image.mux.com/${f.playback_id}/thumbnail.jpg?time=1&width=640&height=360&fit_mode=preserve`
            : "/placeholder.jpg";

        return (
          <Link
            key={f.id}
            href={`/film/${f.id}`}
            className="block rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition"
          >
            <div className="relative bg-black aspect-video">
              {/* картинка-превью, покрывает контейнер */}
              {/* @ts-expect-error img onError */}
              <img
                src={poster}
                alt={f.title ?? "Poster"}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e: any) => {
                  e.currentTarget.src = "/placeholder.jpg";
                }}
              />
              <span className="absolute left-3 top-3 text-xs font-bold bg-emerald-600 text-white rounded px-2 py-1">
                NEW
              </span>
            </div>

            <div className="p-4">
              <div className="text-sm text-gray-500">
                {formatDuration(f.duration_seconds)}
              </div>
              <div className="text-lg font-semibold">
                {f.title ?? "Без названия"}
              </div>
            </div>
          </Link>
        )})}
      </div>
    </main>
  );
}
