import { getBaseUrl } from './getBaseUrl';

export const SITE_NAME = 'WAIVA';
export const SITE_TITLE = 'WAIVA - AI Image Gallery';
export const SITE_DESCRIPTION =
  'Explore AI-generated images on WAIVA by prompts, AI models, tags, aspect ratios, color palettes, and visual styles.';
export const SITE_GITHUB_URL = 'https://github.com/marfandre/aiflix-next';

export const SITE_KEYWORDS = [
  'WAIVA',
  'AI image gallery',
  'AI images',
  'AI art',
  'AI prompts',
  'AI image prompts',
  'AI model images',
  'color palette inspiration',
  'AI visual discovery',
];

export function siteUrl(path = '/'): string {
  const base = getBaseUrl().replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function siteJsonLd() {
  const home = siteUrl('/');
  const organizationId = `${home}#organization`;
  const websiteId = `${home}#website`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: SITE_NAME,
        url: home,
        logo: siteUrl('/logo.png'),
        sameAs: [SITE_GITHUB_URL],
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        name: SITE_NAME,
        url: home,
        description: SITE_DESCRIPTION,
        inLanguage: 'en',
        publisher: {
          '@id': organizationId,
        },
      },
    ],
  };
}
