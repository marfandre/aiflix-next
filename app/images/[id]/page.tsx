// aiflix/app/images/[id]/page.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import { getBaseUrl } from '@/lib/getBaseUrl';
import { hexToFamily } from '@/lib/color-utils';
import {
  imageAspectLandingHref,
  imageColorLandingHref,
  imageModelLandingHref,
  imageTagLandingHref,
} from '@/app/images/_lib/seoLinks';
import { PUBLIC_CREATOR_LABEL, SHOW_PUBLIC_AUTHOR_IDENTITY } from '@/lib/publicIdentity';

type Props = { params: { id: string } };

export const revalidate = 60;

function publicImageUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  return `${base}/storage/v1/object/public/images/${path}`;
}

const MODEL_LABELS: Record<string, string> = {
  midjourney: 'MidJourney',
  sdxl: 'SDXL',
  'sd-xl': 'SDXL',
  'stable diffusion xl': 'Stable Diffusion XL',
  'stable-diffusion-xl': 'Stable Diffusion XL',
  dalle: 'DALL\u00B7E',
  'dall-e': 'DALL\u00B7E',
  'dalle 3': 'DALL\u00B7E 3',
  'dall-e 3': 'DALL\u00B7E 3',
  'dall-e-3': 'DALL\u00B7E 3',
  flux: 'Flux',
  krea: 'KREA',
  sora: 'Sora',
  pika: 'Pika',
  runway: 'Runway',
  'gen-3': 'Gen-3',
  veo: 'Veo',
  'veo-2': 'Veo 2',
  'veo-3': 'Veo 3',
  'veo-3.1': 'Veo 3.1',
  kandinsky: 'Kandinsky',
  leonardo: 'Leonardo',
  ideogram: 'Ideogram',
  playground: 'Playground',
};

function formatModelName(raw?: string | null): string | null {
  if (!raw) return null;
  const key = raw.toLowerCase().trim();
  return MODEL_LABELS[key] ?? raw;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const year = date.getFullYear().toString().slice(-2);
  return `${month} ${year}`;
}

function cleanText(value?: string | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function humanizeTag(tag: string): string {
  return tag.replace(/:(en|ru)$/i, '').replace(/[_-]+/g, ' ').trim();
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = cleanText(raw);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function absoluteUrl(path: string): string {
  const base = getBaseUrl().replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function buildImageTitle(data: { title?: string | null; tags?: string[] | null; model?: string | null }): string {
  const explicitTitle = cleanText(data.title);
  if (explicitTitle) return explicitTitle;

  const tags = (data.tags ?? []).map(humanizeTag).filter(Boolean).slice(0, 3);
  if (tags.length) return `${tags.join(', ')} AI image`;

  const modelLabel = formatModelName(data.model);
  return modelLabel ? `${modelLabel} AI image` : 'AI Image';
}

function buildImageDescription(data: {
  title?: string | null;
  description?: string | null;
  prompt?: string | null;
  model?: string | null;
  tags?: string[] | null;
  aspect_ratio?: string | null;
}): string {
  const direct = cleanText(data.description) || cleanText(data.prompt);
  if (direct) return truncateText(direct, 155);

  const title = buildImageTitle(data);
  const modelLabel = formatModelName(data.model);
  const tags = (data.tags ?? []).map(humanizeTag).filter(Boolean).slice(0, 3);
  const details = uniqueValues([
    modelLabel ? `created with ${modelLabel}` : null,
    data.aspect_ratio ? `${data.aspect_ratio} format` : null,
    tags.length ? `tagged ${tags.join(', ')}` : null,
  ]);

  return truncateText(
    details.length
      ? `${title} on WAIVA, ${details.join(', ')}.`
      : `${title} on WAIVA, an AI-generated image gallery.`,
    155
  );
}

function buildImageAlt(data: {
  title: string;
  model?: string | null;
  tags?: string[] | null;
  aspect_ratio?: string | null;
}): string {
  const modelLabel = formatModelName(data.model);
  const tags = (data.tags ?? []).map(humanizeTag).filter(Boolean).slice(0, 3);
  const parts = uniqueValues([
    data.title,
    modelLabel ? `AI-generated image created with ${modelLabel}` : 'AI-generated image',
    tags.length ? `featuring ${tags.join(', ')}` : null,
    data.aspect_ratio ? `${data.aspect_ratio} format` : null,
  ]);

  return truncateText(parts.join('. '), 180);
}

function inferEncodingFormat(path: string): string | undefined {
  const ext = path.split('?')[0]?.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return undefined;
}

// OG metadata для шаринга
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

  const { data } = await supabase
    .from('images_meta')
    .select('path, title, description, prompt, created_at, colors, accent_colors, color_families, model, aspect_ratio, tags')
    .eq('id', params.id)
    .maybeSingle();

  if (!data) return { title: 'Image not found' };

  const title = buildImageTitle(data as any);
  const description = buildImageDescription(data as any);
  const imageUrl = publicImageUrl(data.path);
  const canonical = absoluteUrl(`/images/${params.id}`);
  const imageAlt = buildImageAlt({
    title,
    model: (data as any).model,
    tags: (data as any).tags,
    aspect_ratio: (data as any).aspect_ratio,
  });
  const keywords = uniqueValues([
    title,
    formatModelName((data as any).model),
    ...(((data as any).tags ?? []) as string[]).map(humanizeTag),
    ...(((data as any).colors ?? []) as string[]),
    ...(((data as any).accent_colors ?? []) as string[]),
    'AI image',
    'AI art',
    'WAIVA',
  ]);

  return {
    metadataBase: new URL(getBaseUrl()),
    title,
    description,
    keywords,
    authors: [{ name: 'WAIVA' }],
    creator: 'WAIVA',
    publisher: 'WAIVA',
    alternates: { canonical },
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
      title,
      description,
      url: canonical,
      siteName: 'WAIVA',
      images: [{ url: imageUrl, alt: imageAlt }],
      type: 'article',
      publishedTime: (data as any).created_at ?? undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url: imageUrl, alt: imageAlt }],
    },
  };
}

export default async function ImageViewByIdPage({ params }: Props) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

  const { data, error } = await supabase
    .from('images_meta')
    .select(
      'id, path, title, description, prompt, created_at, user_id, colors, accent_colors, color_families, model, aspect_ratio, tags, profiles:profiles(username, avatar_url)'
    )
    .eq('id', params.id)
    .maybeSingle();

  if (error || !data) return notFound();

  const title = buildImageTitle(data as any);
  const profiles = data.profiles as any;
  const nick = Array.isArray(profiles)
    ? profiles[0]?.username ?? 'Гость'
    : profiles?.username ?? 'Гость';
  const avatar = Array.isArray(profiles)
    ? profiles[0]?.avatar_url ?? null
    : profiles?.avatar_url ?? null;

  const url = publicImageUrl(data.path);
  const colors: string[] = (data as any).colors ?? [];
  const accentColors: string[] = ((data as any).accent_colors ?? []).filter((c: string) => c && c.trim());
  const colorFamilies: string[] = (data as any).color_families ?? [];
  const rawModel = cleanText((data as any).model);
  const modelLabel = formatModelName(rawModel);
  const aspectRatio = (data as any).aspect_ratio;
  const tags: string[] = (data as any).tags ?? [];
  const displayTags = tags.map(humanizeTag).filter(Boolean);
  const dateLabel = data.created_at ? formatDate(data.created_at) : null;
  const linkedColors = colors.map((color, index) => ({
    color,
    family: colorFamilies[index] || hexToFamily(color),
  }));
  const linkedAccentColors = accentColors.map((color) => ({
    color,
    c: color,
    family: hexToFamily(color),
  }));
  const relatedLinks = [
    rawModel && modelLabel ? { href: imageModelLandingHref(rawModel), label: `${modelLabel} AI images` } : null,
    aspectRatio ? { href: imageAspectLandingHref(aspectRatio), label: `${aspectRatio} AI images` } : null,
    ...tags.slice(0, 6).map((tag) => ({ href: imageTagLandingHref(tag), label: `${humanizeTag(tag)} AI images` })),
    ...Array.from(new Set(linkedColors.map((item) => item.family))).slice(0, 4).map((family) => ({
      href: imageColorLandingHref(family),
      label: `${family} AI images`,
    })),
  ].filter((item): item is { href: string; label: string } => !!item);

  const canonical = absoluteUrl(`/images/${data.id}`);
  const imageAlt = buildImageAlt({
    title,
    model: (data as any).model,
    tags,
    aspect_ratio: aspectRatio,
  });
  const seoDescription = buildImageDescription(data as any);
  const keywordList = uniqueValues([
    title,
    modelLabel,
    ...displayTags,
    ...colors,
    ...accentColors,
    'AI image',
    'AI art',
    'WAIVA',
  ]);
  const creatorUrl = SHOW_PUBLIC_AUTHOR_IDENTITY && nick ? absoluteUrl(`/u/${encodeURIComponent(nick)}`) : undefined;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': canonical,
        url: canonical,
        name: `${title} | WAIVA`,
        description: seoDescription,
        isPartOf: {
          '@type': 'WebSite',
          name: 'WAIVA',
          url: absoluteUrl('/'),
        },
        primaryImageOfPage: {
          '@id': `${canonical}#primaryimage`,
        },
      },
      {
        '@type': 'ImageObject',
        '@id': `${canonical}#primaryimage`,
        name: title,
        alternateName: imageAlt,
        description: seoDescription,
        contentUrl: url,
        thumbnailUrl: url,
        url: canonical,
        mainEntityOfPage: { '@id': canonical },
        datePublished: data.created_at ?? undefined,
        encodingFormat: inferEncodingFormat(data.path),
        representativeOfPage: true,
        creator: SHOW_PUBLIC_AUTHOR_IDENTITY && nick ? { '@type': 'Person', name: nick, url: creatorUrl } : { '@type': 'Organization', name: PUBLIC_CREATOR_LABEL },
        creditText: SHOW_PUBLIC_AUTHOR_IDENTITY ? nick : PUBLIC_CREATOR_LABEL,
        keywords: keywordList.join(', '),
        additionalProperty: [
          modelLabel ? { '@type': 'PropertyValue', name: 'AI model', value: modelLabel } : undefined,
          aspectRatio ? { '@type': 'PropertyValue', name: 'Aspect ratio', value: aspectRatio } : undefined,
          colors.length ? { '@type': 'PropertyValue', name: 'Palette', value: colors.join(', ') } : undefined,
        ].filter(Boolean),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'WAIVA',
            item: absoluteUrl('/'),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Images',
            item: absoluteUrl('/?t=images'),
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: title,
            item: canonical,
          },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#111] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Верхняя навигация */}
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link
          href="/?t=images"
          className="flex items-center gap-1.5 text-sm text-white/70 transition hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Назад
        </Link>
      </div>

      {/* Основной контент */}
      <div className="mx-auto max-w-6xl px-4 pb-12">
        <div className="flex items-start justify-center gap-4">

          {/* Цветовая палитра — слева */}
          {(colors.length > 0 || accentColors.length > 0) && (
            <div className="hidden sm:flex flex-col items-center gap-2 pt-4">
              {/* Акцентные цвета */}
              {linkedAccentColors.map(({ color, c, family }, i) => (
                <Link
                  key={`accent-${i}`}
                  href={imageColorLandingHref(family)}
                  className="block rounded-full border-2 border-white/30 shadow-lg transition hover:scale-110 hover:border-white/70"
                  style={{ backgroundColor: color, width: 18, height: 18 }}
                  title={`Акцент: ${c}`}
                />
              ))}
              {/* Основные цвета */}
              {linkedColors.map(({ color, family }, i) => (
                <Link
                  key={`color-${i}`}
                  href={imageColorLandingHref(family)}
                  className="block rounded-full border border-white/30 shadow-lg transition hover:scale-110 hover:border-white/70"
                  style={{ backgroundColor: color, width: 28, height: 28 }}
                  title={`${color} (${family})`}
                  aria-label={`View ${family} AI images`}
                />
              ))}
            </div>
          )}

          {/* Картинка + инфо-бар */}
          <div className="flex flex-col overflow-hidden rounded-lg shadow-2xl" style={{ maxWidth: 900 }}>
            {/* Картинка */}
            <div className="relative flex items-center justify-center bg-black">
              <img
                src={url}
                alt={imageAlt}
                className="max-h-[80vh] w-auto max-w-full object-contain"
              />
            </div>

            {/* Инфо-бар под картинкой — в стиле модалки */}
            <div className="bg-black/90 backdrop-blur-sm p-3 border-t border-white/20">
              <div className="flex flex-wrap items-center gap-4 text-xs text-white/80">
                <div className="min-w-[180px] flex-1">
                  <h1 className="truncate text-sm font-semibold text-white">{title}</h1>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-white/50">{seoDescription}</p>
                </div>

                {/* Дата */}
                {dateLabel && (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] text-white/50">{dateLabel}</span>
                  </div>
                )}

                {/* Автор */}
                {SHOW_PUBLIC_AUTHOR_IDENTITY && (
                  <Link
                    href={`/u/${encodeURIComponent(nick)}`}
                    className="flex items-center gap-1.5 rounded-full px-2 py-0.5 transition hover:bg-white/20"
                  >
                    {avatar && (
                      <img
                        src={avatar}
                        alt={nick}
                        className="h-4 w-4 rounded-full object-cover ring-1 ring-white/40"
                      />
                    )}
                    <span className="text-white">{nick}</span>
                  </Link>
                )}

                {/* Модель */}
                {rawModel && modelLabel && (
                  <Link
                    href={imageModelLandingHref(rawModel)}
                    className="rounded-full px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-white/70 transition hover:bg-white/20 hover:text-white"
                  >
                    {modelLabel}
                  </Link>
                )}

                {/* Формат */}
                {aspectRatio && (
                  <Link
                    href={imageAspectLandingHref(aspectRatio)}
                    className="rounded-full px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-white/70 transition hover:bg-white/20 hover:text-white"
                  >
                    {aspectRatio}
                  </Link>
                )}

                {/* Теги */}
                {displayTags.length > 0 && (
                  <>
                    {tags.slice(0, 4).map((tag, index) => {
                      const displayName = humanizeTag(tag);
                      return (
                        <Link
                          key={`${tag}-${index}`}
                          href={imageTagLandingHref(tag)}
                          className="rounded-full bg-white/20 px-2 py-0.5 transition hover:bg-white/35"
                        >
                          {displayName}
                        </Link>
                      );
                    })}
                    {displayTags.length > 4 && (
                      <span className="text-white/60">+{displayTags.length - 4}</span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Мобильная палитра */}
            {(colors.length > 0) && (
              <div className="flex sm:hidden items-center justify-center gap-2 bg-black/80 py-2">
                {linkedColors.map(({ color, family }, i) => (
                  <Link
                    key={`mob-${i}`}
                    href={imageColorLandingHref(family)}
                    className="block rounded-full border border-white/40 shadow-md"
                    style={{ backgroundColor: color, width: 22, height: 22 }}
                    title={`${color} (${family})`}
                    aria-label={`View ${family} AI images`}
                  />
                ))}
                {linkedAccentColors.map(({ color, c, family }, i) => (
                  <Link
                    key={`mob-accent-${i}`}
                    href={imageColorLandingHref(family)}
                    className="block rounded-full border border-white/40 shadow-md"
                    style={{ backgroundColor: color, width: 16, height: 16 }}
                    title={c}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Описание / промпт (если есть) */}
        {(data.description || data.prompt) && (
          <div className="mx-auto mt-6 max-w-2xl rounded-lg bg-white/5 p-4 text-sm text-white/70">
            {data.prompt && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-white/40">Промпт</span>
                <p className="mt-1 whitespace-pre-line text-white/80">{data.prompt}</p>
              </div>
            )}
            {data.description && (
              <div className={data.prompt ? 'mt-3 border-t border-white/10 pt-3' : ''}>
                <span className="text-[10px] uppercase tracking-wider text-white/40">Описание</span>
                <p className="mt-1 whitespace-pre-line">{data.description}</p>
              </div>
            )}
          </div>
        )}

        {relatedLinks.length > 0 && (
          <div className="mx-auto mt-4 max-w-2xl rounded-lg bg-white/5 p-4">
            <h2 className="text-[10px] uppercase tracking-wider text-white/40">Explore related AI images</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {relatedLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70 transition hover:bg-white/20 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
