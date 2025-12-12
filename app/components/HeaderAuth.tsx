'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/** Встроенная модалка авторизации */
function AuthModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const supabase = createClientComponentClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const redirectUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/upload` : undefined;

  useEffect(() => {
    if (!open) {
      setEmail('');
      setPassword('');
      setMsg(null);
      setErr(null);
    }
  }, [open]);

  async function signUp() {
    setErr(null);
    setMsg(null);
    if (!email || !password) {
      setErr('Введите почту и пароль.');
      return;
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl },
    });
    if (error) setErr(error.message);
    else setMsg('Мы отправили письмо. Подтвердите почту и вернитесь на сайт.');
  }

  async function signIn() {
    setErr(null);
    setMsg(null);
    if (!email || !password) {
      setErr('Введите почту и пароль.');
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr(error.message);
    else {
      setMsg('Вход выполнен.');
      onClose();
    }
  }

  if (!open) return null;

  return (
    // ↓ Вместо items-center — items-start и вертикальный отступ (опускаем модалку)
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 md:pt-28">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl
                   max-h-[85vh] overflow-auto" // безопасная высота + прокрутка
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold">Вход или регистрация</h3>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        {msg && (
          <div className="mb-3 rounded border border-green-200 bg-green-50 p-2 text-sm text-green-700">
            {msg}
          </div>
        )}
        {err && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {err}
          </div>
        )}

        <label className="mb-1 block text-sm font-medium">Почта</label>
        <input
          type="email"
          className="mb-3 w-full rounded border px-3 py-2"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="mb-1 block text-sm font-medium">Пароль</label>
        <input
          type="password"
          className="mb-4 w-full rounded border px-3 py-2"
          placeholder="минимум 6 символов"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="flex gap-2">
          <button onClick={signUp} className="flex-1 rounded bg-black py-2 text-white">
            Зарегистрироваться
          </button>
          <button onClick={signIn} className="flex-1 rounded border py-2">
            Войти
          </button>
        </div>
      </div>
    </div>
  );
}

/** Кнопка Войти/Выйти + вызов модалки */
export default function HeaderAuth() {
  const supabase = createClientComponentClient();
  const [hasSession, setHasSession] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') window.location.reload();
  }

  return (
    <>
      {!hasSession ? (
        <button
          onClick={() => setOpen(true)}
          className="h-9 rounded-md bg-black px-4 text-sm text-white"
        >
          Войти
        </button>
      ) : (
        <button
          onClick={handleSignOut}
          className="h-9 rounded-full border border-[#ff8b8b] bg-[#ff6b6b]/20 px-4 text-sm font-medium text-black hover:bg-[#ff6b6b]/30 transition"
        >
          Выйти
        </button>
      )}

      <AuthModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
