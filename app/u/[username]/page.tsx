// aiflix/app/u/[username]/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

import ProfileTabs from './ProfileTabs';
import EditProfileModal from '@/app/components/EditProfileModal';
import VideoFeedClient from '@/app/components/VideoFeedClient';
import ImageFeedClient from '@/app/components/ImageFeedClient';
import Avatar from '@/app/components/Avatar';
import { ProfileNotFound, ProfileFallbackName, ProfileUploadCta } from './ProfileHeaderText';
import { absoluteSiteUrl, noindexMetadata } from '@/lib/seoMetadata';
import { PUBLIC_CREATOR_LABEL, SHOW_PUBLIC_AUTHOR_IDENTITY } from '@/lib/publicIdentity';

type PageProps = { params: { username: string }; searchParams?: { t?: string } };
type Tab = 'video' | 'images';

type ProfileRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  first_name: string | null;
  last_name: string | null;
  bio: string | null;
};

type ProfileImageSeoRow = {
  id: string;
  title: string | null;
  description: string | null;
  prompt: string | null;
  path: string | null;
  created_at: string | null;
  model: string | null;
  tags: string[] | null;
  aspect_ratio: string | null;
};

type ProfileVideoSeoRow = {
  id: string;
  title: string | null;
  description: string | null;
  prompt: string | null;
  playback_id: string | null;
  created_at: string | null;
  model: string | null;
  aspect_ratio: string | null;
};

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function cleanText(value?: string | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function profileName(profile: ProfileRow): string {
  if (!SHOW_PUBLIC_AUTHOR_IDENTITY) return PUBLIC_CREATOR_LABEL;
  const fullName = [profile.first_name, profile.last_name].map(cleanText).filter(Boolean).join(' ');
  return fullName || cleanText(profile.username) || 'WAIVA creator';
}

function profileDescription(profile: ProfileRow): string {
  if (!SHOW_PUBLIC_AUTHOR_IDENTITY) {
    return 'Explore AI-generated images on WAIVA with prompts, models, palettes, and visual inspiration.';
  }
  const bio = cleanText(profile.bio);
  if (bio) return truncateText(bio, 155);

  const nick = cleanText(profile.username);
  const name = profileName(profile);
  return `${name}${nick ? ` (@${nick})` : ''} on WAIVA: AI-generated images with prompts, models, palettes, and visual inspiration.`;
}

function profileCanonicalPath(profile: ProfileRow): string {
  return `/u/${encodeURIComponent(cleanText(profile.username) || profile.id)}`;
}

function absoluteMediaUrl(value?: string | null): string | undefined {
  const url = cleanText(value);
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return absoluteSiteUrl(url.startsWith('/') ? url : `/${url}`);
}

function publicImageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? '';
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${base}/storage/v1/object/public/images/${encodedPath}`;
}

function muxPosterUrl(playbackId: string): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1&width=1200`;
}

async function getProfileByUsername(supa: any, username: string): Promise<ProfileRow | null> {
  const { data } = await supa
    .from('profiles')
    .select('id, username, avatar_url, first_name, last_name, bio')
    .ilike('username', safeDecode(username))
    .maybeSingle();

  return (data ?? null) as ProfileRow | null;
}

function profileJsonLd({
  profile,
  images,
  videos,
}: {
  profile: ProfileRow;
  images: ProfileImageSeoRow[];
  videos: ProfileVideoSeoRow[];
}) {
  const canonical = absoluteSiteUrl(profileCanonicalPath(profile));
  const name = profileName(profile);
  const nick = cleanText(profile.username);
  const avatar = absoluteMediaUrl(profile.avatar_url);
  const description = profileDescription(profile);
  const listItems = [
    ...images
      .filter((image) => image.id && image.path)
      .slice(0, 12)
      .map((image) => ({
        type: 'ImageObject',
        url: absoluteSiteUrl(`/images/${image.id}`),
        name: cleanText(image.title) || 'AI image',
        contentUrl: publicImageUrl(image.path as string),
        datePublished: image.created_at ?? undefined,
      })),
    ...videos
      .filter((video) => video.id && video.playback_id)
      .slice(0, 12)
      .map((video) => ({
        type: 'VideoObject',
        url: absoluteSiteUrl(`/film/${video.id}`),
        name: cleanText(video.title) || 'AI video',
        thumbnailUrl: muxPosterUrl(video.playback_id as string),
        uploadDate: video.created_at ?? undefined,
        description: cleanText(video.description) || cleanText(video.prompt) || undefined,
      })),
  ].slice(0, 24);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        '@id': canonical,
        url: canonical,
        name: `${name} on WAIVA`,
        description,
        isPartOf: {
          '@type': 'WebSite',
          name: 'WAIVA',
          url: absoluteSiteUrl('/'),
        },
        mainEntity: {
          '@id': `${canonical}#person`,
        },
        hasPart: {
          '@type': 'ItemList',
          numberOfItems: listItems.length,
          itemListElement: listItems.map((item, index) => {
            const schemaItem = item as any;
            return {
              '@type': 'ListItem',
              position: index + 1,
              url: item.url,
              item: {
                '@type': item.type,
                name: item.name,
                url: item.url,
                ...(item.type === 'ImageObject'
                  ? { contentUrl: schemaItem.contentUrl, datePublished: schemaItem.datePublished }
                  : {
                      thumbnailUrl: schemaItem.thumbnailUrl,
                      uploadDate: schemaItem.uploadDate,
                      description: schemaItem.description,
                    }),
              },
            };
          }),
        },
      },
      {
        '@type': 'Person',
        '@id': `${canonical}#person`,
        name,
        alternateName: nick ? `@${nick}` : undefined,
        url: canonical,
        image: avatar,
        description,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'WAIVA', item: absoluteSiteUrl('/') },
          { '@type': 'ListItem', position: 2, name, item: canonical },
        ],
      },
    ],
  };
}

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

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const supa = createServerComponentClient({ cookies });
  const profile = await getProfileByUsername(supa, params.username);

  if (!profile) return noindexMetadata('Profile not found');
  if (!SHOW_PUBLIC_AUTHOR_IDENTITY) return noindexMetadata('Creator profile');

  const name = profileName(profile);
  const nick = cleanText(profile.username);
  const description = profileDescription(profile);
  const canonicalPath = profileCanonicalPath(profile);
  const canonical = absoluteSiteUrl(canonicalPath);
  const avatar = absoluteMediaUrl(profile.avatar_url);
  const hasTabQuery = !!searchParams?.t;

  return {
    title: `${name} AI Profile`,
    description,
    alternates: {
      canonical,
    },
    robots: {
      index: !hasTabQuery,
      follow: true,
      googleBot: {
        index: !hasTabQuery,
        follow: true,
        'max-image-preview': 'large',
      },
    },
    openGraph: {
      title: `${name} on WAIVA`,
      description,
      url: canonical,
      siteName: 'WAIVA',
      type: 'profile',
      ...(avatar ? { images: [{ url: avatar, alt: nick ? `@${nick}` : name }] } : {}),
    },
    twitter: {
      card: avatar ? 'summary_large_image' : 'summary',
      title: `${name} on WAIVA`,
      description,
      ...(avatar ? { images: [{ url: avatar, alt: nick ? `@${nick}` : name }] } : {}),
    },
  };
}

export default async function PublicProfilePage({ params, searchParams }: PageProps) {
  const supa = createServerComponentClient({ cookies });
  const tab: Tab = searchParams?.t === 'images' ? 'images' : 'video';

  const {
    data: { user },
  } = await supa.auth.getUser();
  const currentUserId = user?.id ?? null;

  const profile = await getProfileByUsername(supa, params.username);

  if (!profile) {
    return <ProfileNotFound />;
  }

  const [profileImages, profileVideos] = await Promise.all([
    selectSafe<ProfileImageSeoRow>(
      supa,
      'images_meta',
      'id, title, description, prompt, path, created_at, model, tags, aspect_ratio',
      [(q) => q.eq('user_id', profile.id), (q) => q.not('path', 'is', null)],
      { column: 'created_at', ascending: false },
      12
    ),
    selectSafe<ProfileVideoSeoRow>(
      supa,
      'films',
      'id, title, description, prompt, playback_id, created_at, model, aspect_ratio',
      [(q) => q.eq('author_id', profile.id), (q) => q.not('playback_id', 'is', null)],
      { column: 'created_at', ascending: false },
      12
    ),
  ]);

  const isOwn = user?.id === profile.id;
  const nick = (profile.username ?? '').trim();
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
  const avatar = profile.avatar_url || '/placeholder.png';
  const jsonLd = profileJsonLd({
    profile,
    images: profileImages,
    videos: profileVideos,
  });

  return (
    <div className="mx-auto max-w-[2000px] p-4 sm:p-6">
      {SHOW_PUBLIC_AUTHOR_IDENTITY && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {/* Шапка профиля */}
      <div className="mb-2">
        <div className="flex items-start gap-4">
          {SHOW_PUBLIC_AUTHOR_IDENTITY && (
            <>
              <Avatar
                src={profile.avatar_url}
                name={fullName || nick}
                size={64}
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
            </>
          )}

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
              initialUsername={profile.username ?? ''}
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
