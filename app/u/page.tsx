// aiflix/app/u/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export default async function MyProfileRedirect() {
  const supa = createServerComponentClient({ cookies });

  // 1) не залогинен → на страницу загрузки (там есть форма входа)
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect('/upload');

  // 2) после триггера on_auth_user_created у каждого юзера есть строка
  //    в profiles с автогенерированным ником. Если её всё-таки нет
  //    (например, миграция не применена) — фолбэк на главную.
  const { data: profile } = await supa
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  const username = profile?.username?.trim();
  if (!username) redirect('/');

  redirect(`/u/${encodeURIComponent(username)}`);
}
