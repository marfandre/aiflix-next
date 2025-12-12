import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export async function GET(req: NextRequest) {
  const supa = createServerComponentClient({ cookies });
  const { searchParams } = new URL(req.url);
  const peer_id = searchParams.get('peer_id');
  if (!peer_id) return new Response(JSON.stringify({ error: 'peer_id required' }), { status: 400 });

  const { data: { user } } = await supa.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const { data, error } = await supa
    .from('messages')
    .select('id, sender_id, recipient_id, body, created_at')
    .or(
      `and(sender_id.eq.${user.id},recipient_id.eq.${peer_id}),and(sender_id.eq.${peer_id},recipient_id.eq.${user.id})`
    )
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data ?? []), { status: 200 });
}
