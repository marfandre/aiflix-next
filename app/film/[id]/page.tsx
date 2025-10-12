// app/film/[id]/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createClient } from "@supabase/supabase-js";
// ИЛИ используйте ваш хелпер, если он здесь уже работал стабильно:
// import { supabaseServer } from "@/lib/supabase-server";
import VideoPlayer from "@/components/VideoPlayer"; // ваш компонент плеера
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function FilmPage({
  params,
}: {
  params: { id: string };
}) {
  const { data: film, error } = await supabase
    .from("films")
    .select("id, title, playback_id, description, duration_seconds, created_at")
    .eq("id", params.id)
    .single();

  if (error) {
    console.error("Film load error:", error);
    return (
      <main className="max-w-4xl mx-auto p-6">
        <p className="text-red-600">Фильм не найден</p>
        <Link className="text-blue-600 underline" href="/">← На главную</Link>
      </main>
    );
  }

  if (!film?.playback_id) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">
          {film?.title ?? "Без названия"}
        </h1>
        <p className="text-gray-600">
          Видео ещё обрабатывается… Обновите страницу через минуту.
        </p>
        <Link className="text-blue-600 underline" href="/">← На главную</Link>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">
        {film.title ?? "Без названия"}
      </h1>

      <div className="rounded-xl overflow-hidden border border-gray-200 mb-4">
        <VideoPlayer playbackId={film.playback_id} />
      </div>

      {film.description && (
        <p className="text-gray-700 mb-6 whitespace-pre-wrap">{film.description}</p>
      )}

      <Link className="text-blue-600 underline" href="/">← На главную</Link>
    </main>
  );
}
