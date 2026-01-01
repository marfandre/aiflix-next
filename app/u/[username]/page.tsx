// aiflix/app/u/[username]/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

import ProfileTabs from './ProfileTabs';
import MessageButtons from '@/app/components/MessageButtons';
import EditProfileModal from '@/app/components/EditProfileModal';
import LikeButton from '@/app/components/LikeButton';
import ProfileImagesClient from './ProfileImagesClient';

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

const muxPoster = (playback_id?: string | null) =>
  playback_id
    ? `https://image.mux.com/${playback_id}/thumbnail.jpg?time=1&fit_mode=preserve`
    : '/placeholder.png';

const normVideo = (v: any) => ({
  id: v?.id as string,
  title: (v?.title ?? '').toString().trim() || 'Без названия',
  playback_id: v?.playback_id ?? null,
  created_at: v?.created_at ?? null,
});

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

  const films = await selectSafe(
    supa,
    'films',
    'id, title, playback_id, created_at',
    [(q: any) => q.eq('user_id', profile.id)],
    { column: 'created_at', ascending: false },
    120
  );
  const videos = films.map(normVideo);

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
    images = imgsRaw.map(normImage);
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => {
            const href = `/film/${v.id}?from=profile&u=${encodeURIComponent(nick)}`;

            return (
              <div
                key={v.id}
                className="overflow-hidden rounded-xl border bg-white shadow-sm ring-1 ring-gray-100"
              >
                <Link href={href} className="block relative aspect-video bg-black">
                  <img
                    src={muxPoster(v.playback_id)}
                    alt={v.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </Link>

                <div className="p-3">
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <span className="truncate">@{nick}</span>

                    <LikeButton
                      target="film"
                      id={v.id}
                      userId={currentUserId}
                      className="ml-auto shrink-0"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {videos.length === 0 && (
            <div className="text-sm text-gray-500">Здесь пока нет видео.</div>
          )}
        </div>
      ) : (
        /* ----- КАРТИНКИ ----- */
        <ProfileImagesClient
          images={images}
          nick={nick}
          avatarUrl={avatar}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}

