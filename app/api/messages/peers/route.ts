import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export async function GET(req: NextRequest) {
  const supa = createServerComponentClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  // Все сообщения, где пользователь — отправитель или получатель
  const { data: rows, error } = await supa
    .from('messages')
    .select('id, sender_id, recipient_id, body, created_at')
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Список собеседников с последним сообщением
  const peersMap = new Map<string, any>();
  for (const m of rows ?? []) {
    const peerId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
    if (!peersMap.has(peerId)) peersMap.set(peerId, m);
  }
  const peerIds = Array.from(peersMap.keys());

  let profiles: any[] | null = [];
  if (peerIds.length) {
    const res = await supa
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', peerIds);
    profiles = res.data ?? [];
  }

  const result = peerIds.map((id) => {
    const last = peersMap.get(id);
    const p = profiles?.find((x: any) => x.id === id);
    return { peer_id: id, last, profile: p };
  });

  return new Response(JSON.stringify(result), { status: 200 });
}
