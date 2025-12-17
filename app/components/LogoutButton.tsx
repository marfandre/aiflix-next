'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function LogoutButton({ className }: { className?: string }) {
    const supabase = createClientComponentClient();

    async function handleSignOut() {
        await supabase.auth.signOut();
        if (typeof window !== 'undefined') window.location.assign('/');
    }

    return (
        <button
            onClick={handleSignOut}
            className={className ?? 'rounded-full bg-white px-4 py-1.5 text-sm font-semibold shadow ring-1 ring-gray-200 hover:bg-gray-50 text-red-600'}
        >
            Выйти
        </button>
    );
}
