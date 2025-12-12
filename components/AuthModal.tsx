'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function AuthModal({ open, onClose }: Props) {
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
    setErr(null); setMsg(null);
    if (!email || !password) { setErr('Введите почту и пароль.'); return; }
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: redirectUrl },
    });
    if (error) setErr(error.message);
    else setMsg('Мы отправили письмо. Подтвердите почту и вернитесь на сайт.');
  }

  async function signIn() {
    setErr(null); setMsg(null);
    if (!email || !password) { setErr('Введите почту и пароль.'); return; }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr(error.message);
    else {
      setMsg('Вход выполнен.');
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold">Вход или регистрация</h3>
          <button onClick={onClose} className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100">✕</button>
        </div>

        {msg && <div className="mb-3 rounded border border-green-200 bg-green-50 p-2 text-sm text-green-700">{msg}</div>}
        {err && <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{err}</div>}

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
          <button onClick={signUp} className="flex-1 rounded bg-black py-2 text-white">Зарегистрироваться</button>
          <button onClick={signIn} className="flex-1 rounded border py-2">Войти</button>
        </div>
      </div>
    </div>
  );
}
