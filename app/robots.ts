import type { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/getBaseUrl';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();

  return {
    rules: {
      userAgent: '*',
      allow: [
        '/',
        '/images',
        '/images/',
        '/film',
        '/film/',
        '/u',
        '/u/',
      ],
      disallow: [
        '/api/',
        '/auth/',
        '/upload',
        '/saved',
        '/favorites',
        '/profile',
        '/images/*/edit',
        '/film/*/edit',
      ],
    },
    host: baseUrl,
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
