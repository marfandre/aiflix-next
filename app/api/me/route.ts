import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export async function GET() {
  const supa = createServerComponentClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const { data: profile } = await supa
    .from('profiles')
    .select('username, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  return new Response(JSON.stringify({ id: user.id, email: user.email, profile }), { status: 200 });
}
