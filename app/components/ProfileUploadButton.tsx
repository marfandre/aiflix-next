'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type Props = {
  /** id пользователя, чей профиль открыт (owner of the profile page) */
  ownerId: string;
  /** Класс-обёртка (если нужно подстроить отступы рядом с другими кнопками) */
  className?: string;
};

export default function ProfileUploadButton({ ownerId, className }: Props) {
  const supabase = createClientComponentClient();
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      setIsOwner(!!uid && uid === ownerId);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const uid = session?.user?.id;
      setIsOwner(!!uid && uid === ownerId);
    });

    return () => sub.subscription.unsubscribe();
  }, [ownerId, supabase]);

  if (!isOwner) return null;

  // стиль идентичный «Сообщения»/«Редактировать профиль»
  return (
    <Link
      href="/upload"
      className={
        'rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-black hover:bg-gray-50 ' +
        (className ?? '')
      }
    >
      Загрузить
    </Link>
  );
}
