import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export async function POST(req: NextRequest) {
  const supa = createServerComponentClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const body = await req.json();
  let { recipient_id, recipient_username, text } = body || {};
  const message = (text ?? '').toString().trim();
  if (!message) return new Response(JSON.stringify({ error: 'text is required' }), { status: 400 });

  if (!recipient_id && recipient_username) {
    const { data: p } = await supa
      .from('profiles')
      .select('id')
      .ilike('username', recipient_username)
      .maybeSingle();
    recipient_id = p?.id;
  }

  if (!recipient_id) return new Response(JSON.stringify({ error: 'recipient required' }), { status: 400 });
  if (recipient_id === user.id) return new Response(JSON.stringify({ error: 'cannot message yourself' }), { status: 400 });

  const { error } = await supa
    .from('messages')
    .insert({ sender_id: user.id, recipient_id, body: message });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
