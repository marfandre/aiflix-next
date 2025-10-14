// app/page.tsx
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import Image from 'next/image';
import FilmCard from '@/components/FilmCard';
import { supabaseServer } from '../lib/supabase-server';

type FilmRow = {
  id: string;
  title: string | null;
  playback_id?: string | null;
  playbackId?: string | null;
  mux_playback_id?: string | null;
  mux?: { playback_id?: string | null; playbackId?: string | null } | null;
  created_at: string;
};

export default async function Page() {
  const supa = supabaseServer();

  const { data, error } = await supa
    .from('films')
    .select('id, title, playback_id, playbackId, mux_playback_id, mux, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return <div className="p-6 text-red-600">Ошибка загрузки списка фильмов</div>;
  }

  const films = (data ?? []) as FilmRow[];

  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">IOWA</h1>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {films.map((f) => (
          <FilmCard key={f.id} {...f} />
        ))}
      </div>
    </main>
  );
}
