// aiflix/app/images/page.tsx
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

import MediaTabs from '../components/MediaTabs';
import LikeButton from '../components/LikeButton';
import {
  imageAspectLandingHref,
  imageColorLandingHref,
  imageModelLandingHref,
  imageTagLandingHref,
} from './_lib/seoLinks';
import { absoluteSiteUrl } from '@/lib/seoMetadata';

// страница должна быть динамической, без кеша
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'AI Image Gallery',
  description: 'Browse AI-generated images on WAIVA by prompts, models, tags, aspect ratios, creators, and color palettes.',
  alternates: {
    canonical: absoluteSiteUrl('/images'),
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
  openGraph: {
    title: 'AI Image Gallery',
    description: 'Browse AI-generated images on WAIVA by prompts, models, tags, aspect ratios, creators, and color palettes.',
    url: absoluteSiteUrl('/images'),
    siteName: 'WAIVA',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'AI Image Gallery',
    description: 'Browse AI-generated images on WAIVA by prompts, models, tags, aspect ratios, creators, and color palettes.',
  },
};

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
      colors,
      color_families,
      model,
      aspect_ratio,
      tags,
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
            const tags: string[] = row.tags ?? [];
            const colorFamilies = Array.from(
              new Set(((row.color_families ?? []) as string[]).filter(Boolean))
            ).slice(0, 3);
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

                  {(row.model || row.aspect_ratio || tags.length > 0 || colorFamilies.length > 0) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {row.model && (
                        <Link
                          href={imageModelLandingHref(row.model)}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-mono text-gray-600 transition hover:bg-gray-200 hover:text-gray-900"
                        >
                          {row.model}
                        </Link>
                      )}
                      {row.aspect_ratio && (
                        <Link
                          href={imageAspectLandingHref(row.aspect_ratio)}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-mono text-gray-600 transition hover:bg-gray-200 hover:text-gray-900"
                        >
                          {row.aspect_ratio}
                        </Link>
                      )}
                      {tags.slice(0, 3).map((tag) => (
                        <Link
                          key={tag}
                          href={imageTagLandingHref(tag)}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 transition hover:bg-gray-200 hover:text-gray-900"
                        >
                          {tag.replace(/:(en|ru)$/i, '').replace(/[_-]+/g, ' ')}
                        </Link>
                      ))}
                      {colorFamilies.map((family) => (
                        <Link
                          key={family}
                          href={imageColorLandingHref(family)}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 transition hover:bg-gray-200 hover:text-gray-900"
                        >
                          {family}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
