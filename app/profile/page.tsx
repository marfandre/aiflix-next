// aiflix/app/profile/page.tsx
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ProfileRedirectPage() {
    const supabase = createServerComponentClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        // If not logged in, redirect to home or upload
        redirect('/upload');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .maybeSingle();

    if (profile?.username) {
        redirect(`/u/${profile.username}`);
    } else {
        redirect('/account'); // fallback if no username is set yet
    }
}
