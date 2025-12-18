'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/**
 * Кнопка "Понравилось" с сердечком — показывается только авторизованным
 */
export default function FavoritesLink() {
    const supabase = createClientComponentClient();
    const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setIsAuthed(!!data.user);
        });

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsAuthed(!!session?.user);
        });

        return () => sub.subscription.unsubscribe();
    }, [supabase]);

    // Не показываем пока загружается или не авторизован
    if (!isAuthed) return null;

    return (
        <Link
            href="/favorites"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-100 transition"
        >
            Понравилось
            <svg
                className="h-4 w-4 text-red-500"
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
    );
}
