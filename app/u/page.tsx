// aiflix/app/u/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export default async function MyProfileRedirect() {
  const supa = createServerComponentClient({ cookies });

  // 1) не залогинен → на страницу загрузки (там есть форма входа)
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect('/upload');

  // 2) пробуем найти запись профиля
  const { data: profile } = await supa
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  // нет строки в profiles или нет ника → на главную, ник можно задать позже из публичного профиля
  if (!profile) redirect('/');

  const username = profile?.username?.trim();
  if (!username) redirect('/');

  // 3) всё ок → публичный профиль
  redirect(`/u/${encodeURIComponent(username)}`);
}
