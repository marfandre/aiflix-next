// aiflix/app/components/PublicProfileLink.tsx
import Link from 'next/link';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export default async function PublicProfileLink() {
  const supa = createServerComponentClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supa
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  const username = profile?.username?.trim();
  if (!username) return null;

  // Можешь оставить href="/u" — ниже сделаем редирект
  return (
    <Link href="/u" className="rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50">
      Профиль
    </Link>
  );
}
