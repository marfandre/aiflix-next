// aiflix/app/u/[username]/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

import ProfileTabs from './ProfileTabs';
import MessageButtons from '@/app/components/MessageButtons';
import EditProfileModal from '@/app/components/EditProfileModal';
import VideoFeedClient from '@/app/components/VideoFeedClient';
import ImageFeedClient from '@/app/components/ImageFeedClient';

type PageProps = { params: { username: string }; searchParams?: { t?: string } };
type Tab = 'video' | 'images';

async function selectSafe<T = any>(
  supa: any,
  table: string,
  select: string,
  filters: Array<(q: any) => any> = [],
  order?: { column: string; ascending?: boolean },
  limit?: number
): Promise<T[]> {
  try {
    let q = supa.from(table).select(select);
    for (const f of filters) q = f(q);
    if (order) q = q.order(order.column, { ascending: !!order.ascending });
    if (limit) q = q.limit(limit);
    const { data } = await q;
    return (data ?? []) as T[];
  } catch {
    return [];
  }
}

const normImage = (im: any) => {
  const path = im?.path ?? im?.url ?? null;
  return {
    id: im?.id as string,
    title: (im?.title ?? '').toString().trim() || 'Без названия',
    description: im?.description ?? '',
    created_at: im?.created_at ?? null,
    path,
    prompt: im?.prompt ?? null,
    colors: im?.colors ?? null,
    model: im?.model ?? null,
    tags: im?.tags ?? null,
    images_count: im?.images_count ?? null,
  };
};

export default async function PublicProfilePage({ params, searchParams }: PageProps) {
  const supa = createServerComponentClient({ cookies });
  const tab: Tab = searchParams?.t === 'images' ? 'images' : 'video';

  const {
    data: { user },
  } = await supa.auth.getUser();
  const currentUserId = user?.id ?? null;

  const { data: profile } = await supa
    .from('profiles')
    .select('id, username, avatar_url, first_name, last_name, bio')
    .ilike('username', params.username)
    .maybeSingle();

  if (!profile) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-xl border bg-white p-6 text-center shadow-sm">
          Профиль не найден
        </div>
      </div>
    );
  }

  const isOwn = user?.id === profile.id;
  const nick = (profile.username ?? '').trim();
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
  const avatar = profile.avatar_url || '/placeholder.png';

  // Загружаем полные данные видео для VideoFeedClient
  const films = await selectSafe(
    supa,
    'films',
    'id, author_id, title, description, prompt, playback_id, created_at, model, genres, mood, colors, colors_preview, status',
    [(q: any) => q.eq('author_id', profile.id)],
    { column: 'created_at', ascending: false },
    120
  );

  // Добавляем profiles для совместимости с VideoFeedClient
  const videosForFeed = films.map((f: any) => ({
    ...f,
    profiles: { username: profile.username, avatar_url: profile.avatar_url }
  }));

  let images: any[] = [];
  if (tab === 'images') {
    const img_meta = await selectSafe(
      supa,
      'images_meta',
      'id, user_id, path, title, description, created_at, prompt, colors, model, tags, images_count',
      [(q: any) => q.eq('user_id', profile.id)],
      { column: 'created_at', ascending: false },
      120
    );

    const img_images = await selectSafe(
      supa,
      'images',
      'id, user_id, path, url, title, description, created_at',
      [(q: any) => q.eq('user_id', profile.id)],
      { column: 'created_at', ascending: false },
      120
    );

    const imgsRaw = img_meta.length ? img_meta : img_images;

    // Добавляем profiles для совместимости с ImageFeedClient
    images = imgsRaw.map((im: any) => ({
      ...normImage(im),
      user_id: im.user_id,
      profiles: { username: profile.username, avatar_url: profile.avatar_url }
    }));
  }

  return (
    <div className="mx-auto max-w-[2000px] p-4 sm:p-6">
      {/* Шапка профиля */}
      <div className="mb-2">
        <div className="flex items-start gap-4">
          <img
            src={avatar}
            alt={nick}
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0">
            <div className="text-lg font-semibold leading-tight">
              {fullName || nick || 'Профиль'}
            </div>
            {nick && <div className="text-sm text-gray-500">@{nick}</div>}
            {profile.bio && (
              <div className="mt-3 max-w-prose text-sm text-gray-700">{profile.bio}</div>
            )}
          </div>

          <div className="ml-auto shrink-0">
            {isOwn && (
              <Link
                href="/upload"
                className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold shadow ring-1 ring-gray-200 hover:bg-gray-50"
              >
                Загрузить
              </Link>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {isOwn ? (
            <>
              <MessageButtons isOwn={true} profileId={profile.id} />
              <EditProfileModal
                initialFirst={profile.first_name ?? ''}
                initialLast={profile.last_name ?? ''}
                initialAvatarUrl={avatar}
                initialBio={profile.bio ?? ''}
                label="Редактировать"
                className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold shadow ring-1 ring-gray-200 hover:bg-gray-50"
              />
            </>
          ) : (
            <Link
              href={`/messages/new?to=${profile.id}`}
              className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold shadow ring-1 ring-gray-200 hover:bg-gray-50"
            >
              Сообщение
            </Link>
          )}
        </div>
      </div>

      <div className="mt-6 mb-14 flex justify-center">
        <ProfileTabs />
      </div>

      {/* ----- ВИДЕО ----- */}
      {tab === 'video' ? (
        videosForFeed.length > 0 ? (
          <VideoFeedClient
            userId={currentUserId}
            initialVideos={videosForFeed}
          />
        ) : (
          <div className="text-sm text-gray-500">Здесь пока нет видео.</div>
        )
      ) : (
        /* ----- КАРТИНКИ ----- */
        images.length > 0 ? (
          <ImageFeedClient
            userId={currentUserId}
            initialImages={images}
            isOwnerView={isOwn}
          />
        ) : (
          <div className="text-sm text-gray-500">Здесь пока нет картинок.</div>
        )
      )}
    </div>
  );
}

