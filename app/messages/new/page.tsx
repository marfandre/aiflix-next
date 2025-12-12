'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function NewMessagePage() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const to = searchParams.get('to');

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleSend = async () => {
    if (!text.trim() || !to) return;
    setSending(true);
    setStatus(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStatus('Ошибка: вы не авторизованы');
      setSending(false);
      return;
    }

    // теперь используем правильные поля: sender_id, recipient_id, body
    const { error } = await supabase.from('messages').insert([
      { sender_id: user.id, recipient_id: to, body: text }
    ]);

    if (error) {
      console.error(error);
      setStatus('Не удалось отправить сообщение');
    } else {
      setStatus('Сообщение отправлено!');
      setText('');
      setTimeout(() => router.push('/messages'), 1000);
    }

    setSending(false);
  };

  return (
    <div className="max-w-xl mx-auto mt-10 bg-white border rounded-2xl p-6 shadow-sm">
      <h1 className="text-xl font-semibold mb-4">Новое сообщение</h1>
      <textarea
        className="w-full border rounded-lg p-3 text-sm outline-none focus:ring"
        placeholder="Введите сообщение..."
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        onClick={handleSend}
        disabled={sending || !text.trim()}
        className="mt-3 rounded-full bg-black text-white px-5 py-2 text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
      >
        {sending ? 'Отправка...' : 'Отправить'}
      </button>
      {status && <p className="mt-3 text-sm text-gray-600">{status}</p>}
    </div>
  );
}
