'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type Props = {
  isOwn: boolean;
  profileId: string;
};

export default function MessageButtons({ isOwn, profileId }: Props) {
  const supabase = createClientComponentClient();
  const [unread, setUnread] = useState(0);

  // Подсчёт непрочитанных для владельца профиля
  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const refetch = async () => {
      if (!isOwn) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted || !user) return;

      const { count } = await supabase
        .from('messages')
        .select('*', { head: true, count: 'exact' })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      setUnread(count ?? 0);
    };

    refetch();
    const onFocus = () => refetch();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    channel = supabase
      .channel('messages-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, refetch)
      .subscribe();

    return () => {
      mounted = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwn]);

  // ВЛАДЕЛЕЦ ПРОФИЛЯ: только кнопка "Сообщения" (без редактирования)
  if (isOwn) {
    return (
      <Link
        href="/messages"
        className="relative rounded-full bg-white px-4 py-1.5 text-sm font-semibold shadow ring-1 ring-gray-200 hover:bg-gray-50"
      >
        Сообщения
        {unread > 0 && (
          <span
            aria-label="Есть новые сообщения"
            className="absolute -right-1 top-0 inline-block h-2.5 w-2.5 rounded-full bg-red-500"
            title={`${unread}`}
          />
        )}
      </Link>
    );
  }

  // ЧУЖОЙ ПРОФИЛЬ: кнопка "Сообщение"
  return (
    <Link
      href={`/messages/new?to=${profileId}`}
      className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold shadow ring-1 ring-gray-200 hover:bg-gray-50"
    >
      Сообщение
    </Link>
  );
}
