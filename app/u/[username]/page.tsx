// aiflix/app/u/[username]/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

import ProfileTabs from './ProfileTabs';
import EditProfileModal from '@/app/components/EditProfileModal';
import VideoFeedClient from '@/app/components/VideoFeedClient';
import ImageFeedClient from '@/app/components/ImageFeedClient';
import { ProfileNotFound, ProfileFallbackName, ProfileUploadCta } from './ProfileHeaderText';

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
    aspect_ratio: im?.aspect_ratio ?? null,
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
    return <ProfileNotFound />;
  }

  const isOwn = user?.id === profile.id;
  const nick = (profile.username ?? '').trim();
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
  const avatar = profile.avatar_url || '/placeholder.png';

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
              {fullName || nick || <ProfileFallbackName />}
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
                <ProfileUploadCta />
              </Link>
            )}
          </div>
        </div>

        {isOwn && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <EditProfileModal
              initialFirst={profile.first_name ?? ''}
              initialLast={profile.last_name ?? ''}
              initialAvatarUrl={avatar}
              initialBio={profile.bio ?? ''}
              className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold shadow ring-1 ring-gray-200 hover:bg-gray-50"
            />
          </div>
        )}
      </div>

      <div className="mt-6 mb-14 flex justify-center">
        <ProfileTabs />
      </div>

      {/* ----- ВИДЕО ----- */}
      {tab === 'video' ? (
        <VideoFeedClient
          userId={currentUserId}
          isOwnerView={isOwn}
          profileId={profile.id}
        />
      ) : (
        /* ----- КАРТИНКИ ----- */
        <ImageFeedClient
          userId={currentUserId}
          isOwnerView={isOwn}
          profileId={profile.id}
        />
      )}
    </div>
  );
}

