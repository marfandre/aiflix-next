import Link from 'next/link';
import {
  absoluteUrl,
  fetchLandingImages,
  publicImageUrl,
  type LandingConfig,
  type LandingImageRow,
} from '../_lib/seoLanding';
import {
  imageAspectLandingHref,
  imageColorLandingHref,
  imageModelLandingHref,
} from '../_lib/seoLinks';
import { SHOW_PUBLIC_AUTHOR_IDENTITY } from '@/lib/publicIdentity';

type Props = {
  config: LandingConfig;
};

function profileFrom(image: LandingImageRow) {
  return Array.isArray(image.profiles) ? image.profiles[0] : image.profiles;
}

function imageTitle(image: LandingImageRow): string {
  const title = image.title?.trim();
  if (title) return title;

  const tags = (image.tags ?? [])
    .map((tag) => tag.replace(/:(en|ru)$/i, '').replace(/[_-]+/g, ' '))
    .filter(Boolean)
    .slice(0, 2);

  if (tags.length) return `${tags.join(', ')} AI image`;
  if (image.model) return `${image.model} AI image`;
  return 'AI image';
}

function imageAlt(image: LandingImageRow): string {
  const title = imageTitle(image);
  const tags = (image.tags ?? [])
    .map((tag) => tag.replace(/:(en|ru)$/i, '').replace(/[_-]+/g, ' '))
    .filter(Boolean)
    .slice(0, 3);

  return [
    title,
    image.model ? `created with ${image.model}` : null,
    tags.length ? `tagged ${tags.join(', ')}` : null,
    image.aspect_ratio ? `${image.aspect_ratio} format` : null,
  ].filter(Boolean).join('. ');
}

function jsonLdFor(config: LandingConfig, images: LandingImageRow[]) {
  const canonical = absoluteUrl(config.canonicalPath);
  const itemList = images.slice(0, 24).map((image, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: absoluteUrl(`/images/${image.id}`),
    item: {
      '@type': 'ImageObject',
      name: imageTitle(image),
      contentUrl: publicImageUrl(image.path),
      url: absoluteUrl(`/images/${image.id}`),
      thumbnailUrl: publicImageUrl(image.path),
    },
  }));

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': canonical,
        url: canonical,
        name: config.title,
        description: config.description,
        isPartOf: {
          '@type': 'WebSite',
          name: 'WAIVA',
          url: absoluteUrl('/'),
        },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: images.length,
          itemListElement: itemList,
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'WAIVA', item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: 'Images', item: absoluteUrl('/images') },
          { '@type': 'ListItem', position: 3, name: config.label, item: canonical },
        ],
      },
    ],
  };
}

export default async function ImageSeoLandingPage({ config }: Props) {
  const images = await fetchLandingImages(config);
  const jsonLd = jsonLdFor(config, images);

  return (
    <div className="mx-auto max-w-[2000px] px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="mx-auto mb-8 max-w-4xl text-center">
        <Link href="/?t=images" className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500 hover:text-gray-800">
          Images
        </Link>
        <h1 className="mt-3 text-3xl font-semibold text-gray-950 sm:text-4xl">{config.title}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-gray-600">{config.description}</p>
      </header>

      {images.length === 0 ? (
        <div className="mx-auto max-w-xl rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No images found for {config.label}.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {images.map((image) => {
            const profile = profileFrom(image);
            const username = profile?.username ?? 'user';
            const title = imageTitle(image);

            return (
              <article key={image.id} className="group overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
                <Link href={`/images/${image.id}`} className="block bg-gray-100">
                  <img
                    src={publicImageUrl(image.path)}
                    alt={imageAlt(image)}
                    loading="lazy"
                    className="aspect-[4/5] h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                  />
                </Link>

                <div className="p-3">
                  <Link href={`/images/${image.id}`} className="line-clamp-2 text-sm font-medium text-gray-950 hover:underline">
                    {title}
                  </Link>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    {SHOW_PUBLIC_AUTHOR_IDENTITY && (
                      <Link href={`/u/${encodeURIComponent(username)}`} className="hover:text-gray-900 hover:underline">
                        @{username}
                      </Link>
                    )}
                    {image.model && (
                      <Link href={imageModelLandingHref(image.model)} className="font-mono uppercase tracking-wide hover:text-gray-900 hover:underline">
                        {image.model}
                      </Link>
                    )}
                    {image.aspect_ratio && (
                      <Link href={imageAspectLandingHref(image.aspect_ratio)} className="hover:text-gray-900 hover:underline">
                        {image.aspect_ratio}
                      </Link>
                    )}
                  </div>

                  {image.colors && image.colors.length > 0 && (
                    <div className="mt-3 flex gap-1" aria-label="Image color palette">
                      {image.colors.slice(0, 5).map((color, index) => {
                        const family = image.color_families?.[index];
                        if (!family) {
                          return (
                            <span
                              key={`${image.id}-${color}-${index}`}
                              className="h-3 flex-1 rounded-sm ring-1 ring-black/10"
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          );
                        }

                        return (
                          <Link
                            key={`${image.id}-${color}-${index}`}
                            href={imageColorLandingHref(family)}
                            className="h-3 flex-1 rounded-sm ring-1 ring-black/10 transition hover:scale-y-125"
                            style={{ backgroundColor: color }}
                            title={`${color} (${family})`}
                            aria-label={`View ${family} AI images`}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
