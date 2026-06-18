import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
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
    host: BASE_URL,
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
