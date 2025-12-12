'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import clsx from 'clsx';

type Props = {
  target: 'film' | 'image';     // что лайкаем
  id: string;                   // id фильма или картинки
  userId?: string | null;       // можно передавать с сервера, но мы всё равно проверяем auth
  className?: string;
};

type LikeRow = {
  user_id: string;
  film_id: string | null;
  image_id?: string | null;
};

export default function LikeButton({ target, id, userId, className }: Props) {
  const supabase = createClientComponentClient();

  const [currentUserId, setCurrentUserId] = useState<string | null>(
    userId ?? null
  );
  const [count, setCount] = useState<number>(0);
  const [liked, setLiked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loaded, setLoaded] = useState<boolean>(false); // <- добавили

  const column = target === 'film' ? 'film_id' : 'image_id';

  // 1. Получаем актуальный userId из Supabase auth на клиенте (если не пришёл с сервера)
  useEffect(() => {
    if (currentUserId) return;

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          console.error('LikeButton auth.getUser error:', error);
          return;
        }
        if (!cancelled) {
          setCurrentUserId(data.user?.id ?? null);
        }
      } catch (e) {
        console.error('LikeButton auth.getUser unexpected error:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, supabase]);

  // 2. Читаем лайки для текущего объекта
  const loadState = useCallback(
    async (uid: string | null) => {
      try {
        const { data, error, count: total } = await supabase
          .from<LikeRow>('likes')
          .select('user_id', { count: 'exact' })
          .eq(column as any, id);

        if (error) {
          console.error('LikeButton loadState select error:', error);
          return;
        }

        const rows = data ?? [];
        const likesCount = typeof total === 'number' ? total : rows.length;
        const isLiked = !!uid && rows.some((r) => r.user_id === uid);

        setCount(likesCount);
        setLiked(isLiked);
      } catch (e) {
        console.error('LikeButton loadState unexpected error:', e);
      }
    },
    [supabase, column, id]
  );

  // 3. Первичная загрузка и обновление при смене пользователя/объекта
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      await loadState(currentUserId);
      if (!cancelled) {
        setLoading(false);
        setLoaded(true); // <- отмечаем, что данные пришли
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadState, currentUserId]);

  // 4. Клик по сердечку
  const handleClick = async () => {
    if (loading) return;

    if (!currentUserId) {
      alert('Чтобы ставить лайки, войди в аккаунт.');
      return;
    }

    try {
      if (liked) {
        // снять лайк (оптимистично)
        setLiked(false);
        setCount((c) => Math.max(0, c - 1));

        const { error } = await supabase
          .from('likes')
          .delete()
          .match({ user_id: currentUserId, [column]: id });

        if (error) {
          console.error('LikeButton unlike error:', error);
          alert('Ошибка при снятии лайка: ' + error.message);
          // откат
          setLiked(true);
          setCount((c) => c + 1);
        }
      } else {
        // поставить лайк (оптимистично)
        setLiked(true);
        setCount((c) => c + 1);

        const payload: any = {
          user_id: currentUserId,
          film_id: target === 'film' ? id : null,
        };
        if (target === 'image') {
          payload.image_id = id;
        }

        const { error } = await supabase.from('likes').insert(payload);

        if (error) {
          if ((error as any).code === '23505') {
            // лайк уже есть → просто пересинхронизируем состояние
            console.warn('Like already exists, resyncing state');
            await loadState(currentUserId);
          } else {
            console.error('LikeButton like error:', error);
            alert('Ошибка при постановке лайка: ' + error.message);
            // откат
            setLiked(false);
            setCount((c) => Math.max(0, c - 1));
          }
        }
      }
    } catch (e: any) {
      console.error('LikeButton handleClick unexpected error:', e);
      alert('Не удалось обновить лайк: ' + (e?.message ?? 'unknown error'));
      await loadState(currentUserId);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={clsx(
        'inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 disabled:opacity-50',
        className
      )}
      aria-pressed={liked}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className={clsx(
          'h-4 w-4 transition-colors',
          !loaded && 'invisible', // <- пока не загрузили — невидимое сердечко
          loaded && liked && 'fill-red-500 text-red-500'
        )}
      >
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{count}</span>
    </button>
  );
}
