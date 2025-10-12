// app/page.tsx
export const dynamic = 'force-dynamic';

import Link from "next/link";
import { supabaseServer } from "../lib/supabase-server";

type Film = {
  id: string;
  title: string | null;
  playback_id: string | null;
  duration_seconds: number | null;
  created_at: string | null;
};

function formatDuration(totalSeconds: number | null) {
  if (!totalSeconds && totalSeconds !== 0) return "";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function Page() {
  const supa = supabaseServer();

  const { data: films, error } = await supa
    .from("films")
    .select("id, title, playback_id, duration_seconds, created_at")
    .not("playback_id", "is", null)                 // показываем только готовые к воспроизведению
    .order("created_at", { ascending: false })      // новые сверху
    .limit(100);

  if (error) {
    console.error(error);
    return <div className="p-6 text-red-600">Ошибка загрузки фильмов</div>;
  }

  if (!films || films.length === 0) {
    return <div className="p-6 text-gray-500">Пока нет фильмов</div>;
  }

  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">IOWA</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {films.map((f: Film) => {
          // бейдж NEW: ролик моложе 3 суток
          const isNew =
            f.created_at
              ? (Date.now() - new Date(f.created_at).getTime()) < 3 * 24 * 60 * 60 * 1000
              : false;

          const poster =
            f.playback_id
              ? `https://image.mux.com/${f.playback_id}/thumbnail.jpg?fit_mode=preserve&time=1&width=640&height=360`
              : undefined;

          return (
            <Link
              key={f.id}
              href={`/film/${f.id}`}
              className="block rounded-md border border-gray-200 hover:border-gray-300 overflow-hidden shadow-sm hover:shadow-md transition"
            >
              <div className="relative bg-black aspect-[16/9]">
                {isNew && (
                  <span className="absolute left-2 top-2 z-10 text-xs font-semibold bg-emerald-600 text-white rounded px-2 py-1">
                    NEW
                  </span>
                )}
                {poster ? (
                  // постер Mux
                  <img
                    src={poster}
                    alt={f.title ?? "video"}
                    className="absolute inset-0 w-full h-full object-contain bg-black"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-gray-400 text-sm">
                    Нет постера
                  </div>
                )}
              </div>

              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium truncate">
                    {f.title || "Без названия"}
                  </h3>
                  {f.duration_seconds != null && (
                    <span className="shrink-0 text-xs text-gray-500">
                      {formatDuration(f.duration_seconds)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
