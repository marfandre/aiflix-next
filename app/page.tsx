// app/page.tsx
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { getBaseUrl } from '@/lib/getBaseUrl';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function Home() {
  const { data: films } = await supabase
    .from('films')
    .select('id,title,playback_id')
    .order('created_at', { ascending: false });

  const base = getBaseUrl();

  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">AIFLIX</h1>

      <ul className="space-y-3">
        {films?.map((f) => (
          <li key={f.id} className="border rounded p-3 hover:bg-gray-50">
            <Link href={`/film/${f.id}`}>{f.title || 'Без названия'}</Link>
          </li>
        )) ?? <li>Пока нет фильмов</li>}
      </ul>

      <p className="text-xs text-gray-500 mt-6">Base URL: {base}</p>
    </main>
  );
}

