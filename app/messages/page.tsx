'use client';

import { useEffect, useRef, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type Msg = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  is_read: boolean;
};
type Profile = { id: string; username: string; avatar_url: string | null };

export default function MessagesPage() {
  const supabase = createClientComponentClient();
  const [me, setMe] = useState<string | null>(null);

  const [peers, setPeers] = useState<Profile[]>([]);
  const [activePeer, setActivePeer] = useState<Profile | null>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const scrollDown = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

  const fetchDialogs = async (uid: string) => {
    const { data: last = [] } = await supabase
      .from('messages')
      .select('sender_id, recipient_id, created_at')
      .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
      .order('created_at', { ascending: false })
      .limit(100);

    const ids = new Set<string>();
    for (const m of last ?? []) {
      const other = m.sender_id === uid ? m.recipient_id : m.sender_id;
      if (other) ids.add(other);
    }

    if (ids.size === 0) {
      setPeers([]);
      setActivePeer(null);
      return;
    }

    const { data: profiles = [] } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', Array.from(ids));

    const byLast = (p: Profile) =>
      (last.findIndex(m => m.sender_id === p.id || m.recipient_id === p.id) ?? 9999);
    profiles.sort((a, b) => byLast(a) - byLast(b));

    setPeers(profiles);
    if (!activePeer && profiles.length) setActivePeer(profiles[0]);
  };

  // ✔️ СНАЧАЛА помечаем входящие прочитанными, ПОТОМ грузим тред
  const fetchThread = async (uid: string, peerId: string) => {
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('recipient_id', uid)
      .eq('sender_id', peerId)
      .eq('is_read', false);

    const { data: msgs = [] } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${uid},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${uid})`
      )
      .order('created_at', { ascending: true });

    setMessages(msgs);
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted || !user) return;

      setMe(user.id);
      await fetchDialogs(user.id);
      setLoading(false);
    };
    init();

    const channel = supabase
      .channel('msgs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        async (payload) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const m = payload.new as Msg;
          if (!m) return;
          if (m.sender_id === user.id || m.recipient_id === user.id) {
            await fetchDialogs(user.id);
            if (activePeer && (m.sender_id === activePeer.id || m.recipient_id === activePeer.id)) {
              await fetchThread(user.id, activePeer.id);
              scrollDown();
            }
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!me || !activePeer) return;
    fetchThread(me, activePeer.id).then(scrollDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, activePeer?.id]);

  const handleSend = async () => {
    if (!me || !activePeer) return;
    const body = text.trim();
    if (!body) return;

    setText('');
    await supabase.from('messages').insert([
      { sender_id: me, recipient_id: activePeer.id, body }
    ]);
    await fetchThread(me, activePeer.id);
    scrollDown();
  };

  const fmt = (iso?: string) =>
    iso ? new Date(iso).toLocaleString('ru-RU', { hour12: false }) : '';

  return (
    <div className="mx-auto max-w-6xl grid grid-cols-12 gap-4 p-4">
      {/* Диалоги */}
      <div className="col-span-12 md:col-span-3 rounded-2xl border bg-white p-3">
        <div className="text-lg font-semibold mb-2">Диалоги</div>
        <div className="space-y-2">
          {peers.map(p => (
            <button
              key={p.id}
              onClick={() => setActivePeer(p)}
              className={`w-full text-left rounded-xl border px-3 py-2 hover:bg-gray-50 ${activePeer?.id === p.id ? 'ring-1 ring-black/10 bg-gray-50' : ''}`}
            >
              <div className="flex items-center gap-2">
                <img src={p.avatar_url || '/default-avatar.png'} className="h-8 w-8 rounded-full object-cover" />
                <div className="font-medium">{p.username}</div>
              </div>
            </button>
          ))}
          {!loading && peers.length === 0 && (
            <div className="text-sm text-gray-500">Диалогов пока нет</div>
          )}
        </div>
      </div>

      {/* Сообщения */}
      <div className="col-span-12 md:col-span-9 rounded-2xl border bg-white p-3 flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-3">
          {activePeer && messages.map(m => {
            const mine = m.sender_id === me;
            return (
              <div key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${mine ? 'ml-auto bg-blue-50' : 'bg-white border'}`}>
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div className="mt-1 text-[11px] text-gray-500">{fmt(m.created_at)}</div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Ввод */}
        {activePeer && (
          <div className="mt-3 flex gap-2">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey ? (e.preventDefault(), handleSend()) : undefined}
              className="flex-1 rounded-xl border px-3 py-2 outline-none focus:ring"
              placeholder="Ваше сообщение..."
            />
            <button
              onClick={handleSend}
              className="rounded-xl bg-black text-white px-4 py-2 font-medium hover:bg-gray-900"
            >
              Отправить
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
