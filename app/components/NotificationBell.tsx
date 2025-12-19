'use client';

import { useState, useEffect, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

type Notification = {
    id: string;
    type: string;
    is_read: boolean;
    created_at: string;
    film_id: string | null;
    image_id: string | null;
    from_user: {
        username: string | null;
        avatar_url: string | null;
    } | null;
    film?: {
        playback_id: string | null;
        title: string | null;
    } | null;
    image?: {
        path: string | null;
        title: string | null;
    } | null;
};

export default function NotificationBell() {
    const supabase = createClientComponentClient();
    const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const getMuxPoster = (playbackId: string | null) =>
        playbackId ? `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1&width=80&height=80` : null;

    const getImageUrl = (path: string | null) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        const { data } = supabase.storage.from('images').getPublicUrl(path);
        return data.publicUrl;
    };

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            setIsAuthed(!!user);

            if (user) {
                const { data, error } = await supabase
                    .from('notifications')
                    .select(`
                        id,
                        type,
                        is_read,
                        created_at,
                        film_id,
                        image_id,
                        from_user:from_user_id(username, avatar_url),
                        film:film_id(playback_id, title),
                        image:image_id(path, title)
                    `)
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (!error && data) {
                    const mapped = (data as any[]).map((n) => ({
                        ...n,
                        from_user: Array.isArray(n.from_user) ? n.from_user[0] || null : n.from_user,
                        film: Array.isArray(n.film) ? n.film[0] || null : n.film,
                        image: Array.isArray(n.image) ? n.image[0] || null : n.image,
                    }));
                    setNotifications(mapped);
                    setUnreadCount(mapped.filter((n) => !n.is_read).length);
                }
            }
        }

        load();

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsAuthed(!!session?.user);
            if (!session?.user) {
                setNotifications([]);
                setUnreadCount(0);
            }
        });

        return () => sub.subscription.unsubscribe();
    }, [supabase]);

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

    async function markAllRead() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);

        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
    }

    function handleOpen() {
        setOpen(!open);
        if (!open && unreadCount > 0) {
            markAllRead();
        }
    }

    if (!isAuthed) return null;

    return (
        <div ref={dropdownRef} className="relative">
            <button
                onClick={handleOpen}
                className="relative rounded-lg p-2 hover:bg-gray-100 transition"
                aria-label="Уведомления"
            >
                <svg
                    className="h-5 w-5 text-gray-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                    />
                </svg>

                {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border bg-white py-2 shadow-lg z-50">
                    <div className="px-4 py-2 border-b">
                        <span className="text-sm font-semibold text-gray-800">Уведомления</span>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="px-4 py-6 text-center text-sm text-gray-500">
                                Нет уведомлений
                            </div>
                        ) : (
                            notifications.map((n) => {
                                const fromUsername = n.from_user?.username || 'Кто-то';
                                const isFilm = !!n.film_id;
                                const contentType = isFilm ? 'видео' : 'картинку';
                                const contentHref = isFilm ? `/film/${n.film_id}` : `/images/${n.image_id}`;
                                const profileHref = `/u/${encodeURIComponent(fromUsername)}`;

                                const previewUrl = isFilm
                                    ? getMuxPoster(n.film?.playback_id || null)
                                    : getImageUrl(n.image?.path || null);

                                return (
                                    <div
                                        key={n.id}
                                        className={`px-4 py-3 border-b border-gray-100 last:border-b-0 ${!n.is_read ? 'bg-blue-50/50' : ''
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Аватар — ведёт на профиль */}
                                            <Link
                                                href={profileHref}
                                                onClick={() => setOpen(false)}
                                                className="shrink-0 hover:opacity-80 transition"
                                            >
                                                {n.from_user?.avatar_url ? (
                                                    <img
                                                        src={n.from_user.avatar_url}
                                                        alt=""
                                                        className="h-8 w-8 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-500">
                                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </Link>

                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-gray-800">
                                                    {/* Никнейм — ведёт на профиль */}
                                                    <Link
                                                        href={profileHref}
                                                        onClick={() => setOpen(false)}
                                                        className="font-medium hover:underline"
                                                    >
                                                        @{fromUsername}
                                                    </Link>
                                                    {' '}лайкнул(а) вашу {contentType}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    {new Date(n.created_at).toLocaleDateString('ru-RU', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </p>
                                            </div>

                                            {/* Превью — ведёт на контент */}
                                            <Link
                                                href={contentHref}
                                                onClick={() => setOpen(false)}
                                                className="shrink-0 hover:opacity-80 transition"
                                            >
                                                {previewUrl ? (
                                                    <img
                                                        src={previewUrl}
                                                        alt=""
                                                        className="h-10 w-10 rounded-lg object-cover"
                                                    />
                                                ) : (
                                                    <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                                                        <svg className="h-4 w-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </Link>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
