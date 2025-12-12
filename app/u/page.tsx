// aiflix/app/u/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export default async function MyProfileRedirect() {
  const supa = createServerComponentClient({ cookies });

  // 1) не залогинен → на страницу аккаунта
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect('/account');

  // 2) пробуем найти запись профиля
  const { data: profile } = await supa
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  // нет строки в profiles → первичная настройка
  if (!profile) redirect('/account?setup=1');

  const username = profile?.username?.trim();
  if (!username) redirect('/account?setup=1');

  // 3) всё ок → публичный профиль
  redirect(`/u/${encodeURIComponent(username)}`);
}
