// app/page.tsx
import Link from "next/link";
import { supabaseServer } from "@lib/supabase-server"; // как у тебя уже используется в проекте

type Film = {
  id: string;
  title: string | null;
  playback_id: string | null;
  duration_seconds: number | null;
  created_at: string | null;
};

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  // Если часов нет – показываем ММ:СС, иначе Ч:ММ:СС
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function Page() {
  const supa = supabaseServer();

  const { data, error } = await supa
    .from("films")
    .select("id,title,playback_id,duration_seconds,created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <main className="max-w-6xl mx-auto p-4">
        <h1 className="text-2xl font-semibold mb-4">IOWA</h1>
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-red-700">
          Ошибка загрузки: {error.message}
        </div>
      </main>
    );
  }

  const films: Film[] = data ?? [];

  return (
    <main className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">IOWA</h1>

      {/* GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {films.map((f) => {
          const title = f.title || "Без названия";
          const hasThumb = !!f.playback_id;
          const thumb = hasThumb
            ? `https://image.mux.com/${f.playback_id}/thumbnail.jpg?time=2&fit_mode=pad&width=640&height=360`
            : `https://placehold.co/640x360?text=${encodeURIComponent(title)}`;

          const isNew =
            f.created_at && Date.now() - new Date(f.created_at).getTime() < 48 * 60 * 60 * 1000;

          return (
            <Link
              key={f.id}
              href={`/films/${f.id}`}
              className="group rounded-xl overflow-hidden border border-gray-200 hover:shadow-md transition"
            >
              <div className="relative bg-black aspect-video overflow-hidden">
                <img
                  src={thumb}
                  alt={title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  loading="lazy"
                />

                {/* overlay play */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-black/20 grid place-items-center">
                  <div className="h-10 w-10 rounded-full bg-white/90 grid place-items-center">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-black">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>

                {isNew && (
                  <span className="absolute left-2 top-2 rounded bg-emerald-600 text-white text-xs px-2 py-0.5">
                    NEW
                  </span>
                )}
              </div>

              <div className="p-3">
                <div className="line-clamp-1 font-medium">{title}</div>
                {f.duration_seconds != null && (
                  <div className="mt-1 text-xs text-gray-500">
                    {formatDuration(f.duration_seconds)}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
