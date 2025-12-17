'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import AuthModal from './AuthModal';

export default function Header() {
  const supabase = createClientComponentClient();
  const [hasSession, setHasSession] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    // мягко обновим страницу, чтобы серверные компоненты увидели выход
    if (typeof window !== 'undefined') window.location.assign('/');
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          {/* Лого */}
          <Link href="/" className="text-2xl font-extrabold tracking-tight">
            WAIVA
          </Link>

          {/* Навигация слева */}
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/upload" className="hover:underline">Загрузить</Link>
            <Link href="/about" className="hover:underline">О проекте</Link>
          </nav>

          {/* Справа */}
          <div className="ml-auto flex items-center gap-3">
            <Link href="/profile" className="hidden sm:inline hover:underline">Профиль</Link>
            <Link href="/dashboard" className="hidden sm:inline hover:underline">Личный кабинет</Link>

            {/* Кнопка Войти (только для неавторизованных) */}
            {!hasSession && (
              <button
                onClick={() => setAuthOpen(true)}
                className="rounded bg-black px-4 py-2 text-white"
              >
                Войти
              </button>
            )}
          </div>
        </div>
      </header>

      {/* модалка входа */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
