'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/**
 * Выпадающее меню профиля с пунктами:
 * - Профиль
 * - Личный кабинет
 * - Выйти
 */
export default function ProfileDropdown() {
    const supabase = createClientComponentClient();
    const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function loadUser() {
            const { data: { user } } = await supabase.auth.getUser();
            setIsAuthed(!!user);

            if (user) {
                // Загружаем аватар из profiles
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('avatar_url')
                    .eq('id', user.id)
                    .maybeSingle();

                setAvatarUrl(profile?.avatar_url || null);
            }
        }

        loadUser();

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsAuthed(!!session?.user);
            if (!session?.user) {
                setAvatarUrl(null);
            }
        });

        return () => sub.subscription.unsubscribe();
    }, [supabase]);

    // Закрытие по клику вне
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    async function handleSignOut() {
        await supabase.auth.signOut();
        setOpen(false);
        if (typeof window !== 'undefined') window.location.reload();
    }

    // Загрузка
    if (isAuthed === null) return null;

    // Не авторизован — показываем кнопку Войти
    if (!isAuthed) {
        return (
            <>
                <button
                    onClick={() => setAuthModalOpen(true)}
                    className="h-9 rounded-md bg-black px-4 text-sm text-white"
                >
                    Войти
                </button>
                {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
            </>
        );
    }

    // Авторизован — dropdown меню
    return (
        <div ref={dropdownRef} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-100 transition"
            >
                {/* Аватар или placeholder */}
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt="Аватар"
                        className="h-7 w-7 rounded-full object-cover"
                    />
                ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-gray-300 bg-gray-100">
                        <svg
                            className="h-4 w-4 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                            />
                        </svg>
                    </div>
                )}
                Профиль
                <svg
                    className={`h-4 w-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border bg-white py-2 shadow-lg z-50">
                    <Link
                        href="/u"
                        onClick={() => setOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                        Профиль
                    </Link>
                    <Link
                        href="/account"
                        onClick={() => setOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                        Личный кабинет
                    </Link>
                    <hr className="my-1" />
                    <button
                        onClick={handleSignOut}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                        Выйти
                    </button>
                </div>
            )}
        </div>
    );
}

/** Встроенная модалка авторизации */
function AuthModal({ onClose }: { onClose: () => void }) {
    const supabase = createClientComponentClient();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [msg, setMsg] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);

    const redirectUrl =
        typeof window !== 'undefined' ? `${window.location.origin}/upload` : undefined;

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

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 md:pt-28">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl max-h-[85vh] overflow-auto">
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
