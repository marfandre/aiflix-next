'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/**
 * Клиентский вариант: сразу после логина / логаута
 * отображает или скрывает ссылку "Профиль" без перезагрузки.
 */
export default function PublicProfileLink() {
  const supabase = createClientComponentClient();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    // 1) моментальная проверка текущего юзера
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setIsAuthed(!!data.user);
    });

    // 2) подписка на смену состояния (логин/логаут)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setIsAuthed(!!session?.user);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // null = ещё загружается, ничего не мигаем
  if (isAuthed === null) return null;

  // Не залогинен — не показываем ссылку
  if (!isAuthed) return null;

  // Залогинен — ссылка на центральный редирект /u
  return (
    <Link href="/u" className="rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50">
      Профиль
    </Link>
  );
}
