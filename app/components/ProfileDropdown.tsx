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
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('avatar_url')
                    .eq('id', user.id)
                    .maybeSingle();

                console.log('ProfileDropdown avatar load:', { userId: user.id, profile, error });
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
                    className="px-3 py-1 rounded-full text-sm font-medium text-[#1e3a5f] ring-1 ring-[#1e3a5f] transition-all duration-200 hover:bg-[#1e3a5f] hover:text-white"
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
                    <Link
                        href="/saved"
                        onClick={() => setOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                        Сохранённое
                    </Link>
                    <Link
                        href="/favorites"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                        Понравилось
                        <svg
                            className="h-4 w-4 text-red-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                            />
                        </svg>
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

/** Встроенная модалка авторизации через Google */
function AuthModal({ onClose }: { onClose: () => void }) {
    const supabase = createClientComponentClient();
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function signInWithGoogle() {
        setErr(null);
        setLoading(true);
        const redirectTo =
            typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo },
        });
        if (error) {
            setErr(error.message);
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 md:pt-28">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Вход в аккаунт</h3>
                    <button
                        onClick={onClose}
                        className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100"
                        aria-label="Закрыть"
                    >
                        ✕
                    </button>
                </div>

                {err && (
                    <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                        {err}
                    </div>
                )}

                <button
                    onClick={signInWithGoogle}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
                    </svg>
                    {loading ? 'Переход в Google…' : 'Войти через Google'}
                </button>
            </div>
        </div>
    );
}
