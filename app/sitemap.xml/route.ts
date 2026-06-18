import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getBaseUrl } from '@/lib/getBaseUrl';
import { aspectToPathSegment, slugify } from '@/app/images/_lib/seoLinks';
import { SHOW_PUBLIC_AUTHOR_IDENTITY } from '@/lib/publicIdentity';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

type ImageSitemapRow = {
  id: string;
  user_id: string | null;
  path: string | null;
  title: string | null;
  created_at: string | null;
  tags: string[] | null;
  model: string | null;
  color_families: string[] | null;
  aspect_ratio: string | null;
};

type FilmSitemapRow = {
  author_id: string | null;
  created_at: string | null;
};

type ProfileSitemapRow = {
  id: string;
  username: string | null;
  created_at: string | null;
};

const MAX_URLS = 5000;

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function absoluteUrl(path: string): string {
  const base = getBaseUrl().replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function publicImageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? '';
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${base}/storage/v1/object/public/images/${encodedPath}`;
}

function lastModified(value: string | null): string {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function cleanLandingValue(value: string): string {
  return value.replace(/:(en|ru)$/i, '').trim().toLowerCase();
}

function rememberLatest(map: Map<string, string | null>, rawValue: string | null | undefined, date: string | null) {
  if (!rawValue) return;
  const value = cleanLandingValue(rawValue);
  if (!value) return;

  const current = map.get(value);
  if (!current) {
    map.set(value, date);
    return;
  }

  if (date && new Date(date).getTime() > new Date(current).getTime()) {
    map.set(value, date);
  }
}

function urlEntry({
  loc,
  lastmod,
  changefreq,
  priority,
  image,
}: {
  loc: string;
  lastmod: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
  priority: string;
  image?: { loc: string; title?: string | null };
}): string {
  const imageXml = image
    ? `
    <image:image>
      <image:loc>${xmlEscape(image.loc)}</image:loc>${image.title ? `
      <image:title>${xmlEscape(image.title)}</image:title>` : ''}
    </image:image>`
    : '';

  return `
  <url>
    <loc>${xmlEscape(loc)}</loc>
    <lastmod>${xmlEscape(lastmod)}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${imageXml}
  </url>`;
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const staticEntries = [
    urlEntry({
      loc: absoluteUrl('/'),
      lastmod: new Date().toISOString(),
      changefreq: 'daily',
      priority: '1.0',
    }),
    urlEntry({
      loc: absoluteUrl('/images'),
      lastmod: new Date().toISOString(),
      changefreq: 'daily',
      priority: '0.9',
    }),
  ];

  const { data: images, error } = await supabase
    .from('images_meta')
    .select('id, user_id, path, title, created_at, tags, model, color_families, aspect_ratio')
    .not('path', 'is', null)
    .order('created_at', { ascending: false })
    .limit(MAX_URLS);

  if (error) {
    console.error('sitemap images fetch error:', error);
  }

  const { data: films, error: filmsError } = await supabase
    .from('films')
    .select('author_id, created_at')
    .not('author_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(MAX_URLS);

  if (filmsError) {
    console.error('sitemap profile films fetch error:', filmsError);
  }

  const imageEntries = ((images ?? []) as ImageSitemapRow[])
    .filter((image) => image.id && image.path)
    .map((image) =>
      urlEntry({
        loc: absoluteUrl(`/images/${image.id}`),
        lastmod: lastModified(image.created_at),
        changefreq: 'monthly',
        priority: '0.7',
        image: {
          loc: publicImageUrl(image.path as string),
          title: image.title,
        },
      })
    );

  const landingRows = ((images ?? []) as ImageSitemapRow[]).filter((image) => image.id && image.path);
  const tags = new Map<string, string | null>();
  const models = new Map<string, string | null>();
  const colors = new Map<string, string | null>();
  const aspects = new Map<string, string | null>();

  for (const image of landingRows) {
    for (const tag of image.tags ?? []) rememberLatest(tags, tag, image.created_at);
    rememberLatest(models, image.model, image.created_at);
    for (const family of image.color_families ?? []) rememberLatest(colors, family, image.created_at);
    rememberLatest(aspects, image.aspect_ratio, image.created_at);
  }

  const landingEntries = [
    ...[...tags.entries()].map(([tag, modified]) =>
      urlEntry({
        loc: absoluteUrl(`/images/tags/${slugify(tag)}`),
        lastmod: lastModified(modified),
        changefreq: 'weekly',
        priority: '0.6',
      })
    ),
    ...[...models.entries()].map(([model, modified]) =>
      urlEntry({
        loc: absoluteUrl(`/images/models/${slugify(model)}`),
        lastmod: lastModified(modified),
        changefreq: 'weekly',
        priority: '0.6',
      })
    ),
    ...[...colors.entries()].map(([color, modified]) =>
      urlEntry({
        loc: absoluteUrl(`/images/colors/${slugify(color)}`),
        lastmod: lastModified(modified),
        changefreq: 'weekly',
        priority: '0.6',
      })
    ),
    ...[...aspects.entries()].map(([aspect, modified]) =>
      urlEntry({
        loc: absoluteUrl(`/images/aspect/${aspectToPathSegment(aspect)}`),
        lastmod: lastModified(modified),
        changefreq: 'weekly',
        priority: '0.6',
      })
    ),
  ];

  const authorLatest = new Map<string, string | null>();
  for (const image of landingRows) rememberLatest(authorLatest, image.user_id, image.created_at);
  for (const film of ((films ?? []) as FilmSitemapRow[])) rememberLatest(authorLatest, film.author_id, film.created_at);

  let profileEntries: string[] = [];
  const authorIds = [...authorLatest.keys()];
  if (SHOW_PUBLIC_AUTHOR_IDENTITY && authorIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, created_at')
      .in('id', authorIds);

    if (profilesError) {
      console.error('sitemap profiles fetch error:', profilesError);
    }

    profileEntries = ((profiles ?? []) as ProfileSitemapRow[])
      .filter((profile) => profile.id && profile.username)
      .map((profile) =>
        urlEntry({
          loc: absoluteUrl(`/u/${encodeURIComponent(profile.username as string)}`),
          lastmod: lastModified(authorLatest.get(profile.id) ?? profile.created_at),
          changefreq: 'weekly',
          priority: '0.6',
        })
      );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${staticEntries.join('')}${profileEntries.join('')}${landingEntries.join('')}${imageEntries.join('')}
</urlset>
`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
