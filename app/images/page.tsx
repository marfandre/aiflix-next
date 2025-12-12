// aiflix/app/images/page.tsx
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

import MediaTabs from '../components/MediaTabs';
import LikeButton from '../components/LikeButton';

// страница должна быть динамической, без кеша
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ImagesListPage() {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  const { data, error } = await supabase
    .from('images_meta')
    .select(
      `
      id,
      path,
      created_at,
      title,
      user_id,
      profiles (
        username,
        avatar_url
      )
    `
    )
    .order('created_at', { ascending: false })
    .limit(120);

  if (error) {
    console.error('images page fetch error:', error);
  }

  const rows = data ?? [];

  const publicImageUrl = (path: string) =>
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/${path}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex justify-center">
        <MediaTabs />
      </div>

      {rows.length === 0 && (
        <div className="text-sm text-gray-500">Пока нет картинок.</div>
      )}

      {rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {rows.map((row: any) => {
            const p = Array.isArray(row.profiles)
              ? row.profiles[0]
              : row.profiles;
            const nick: string = p?.username ?? 'user';
            const avatar: string | null = p?.avatar_url ?? null;
            const title = (row.title ?? '').trim() || 'Картинка';
           
            const url = publicImageUrl(row.path);
            const href = `/images/${encodeURIComponent(row.id)}`;

            return (
              <div
                key={row.id}
                className="overflow-hidden rounded-xl border bg-white shadow-sm ring-1 ring-gray-100"
              >
                <Link
                  href={href}
                  className="block relative aspect-[4/3] bg-gray-100"
                >
                  <img
                    src={url}
                    alt={title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </Link>

                <div className="px-4 py-3">
                  

                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <Link
                      href={`/u/${encodeURIComponent(nick)}`}
                      className="flex min-w-0 items-center gap-2 hover:underline"
                    >
                      {avatar && (
                        <img
                          src={avatar}
                          alt={nick}
                          className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-gray-300"
                        />
                      )}
                      <span className="truncate">@{nick}</span>
                    </Link>

                    <LikeButton
                      target="image"
                      id={row.id}
                      userId={userId}
                      className="ml-auto shrink-0"
                    />

                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
