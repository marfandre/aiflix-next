import type { Metadata } from 'next';
import { getBaseUrl } from './getBaseUrl';

export function absoluteSiteUrl(path: string): string {
  const base = getBaseUrl().replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function noindexMetadata(title: string): Metadata {
  return {
    metadataBase: new URL(getBaseUrl()),
    title,
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
      },
    },
  };
}

export function noindexFollowMetadata(title: string, canonicalPath: string): Metadata {
  return {
    metadataBase: new URL(getBaseUrl()),
    title: {
      absolute: title,
    },
    alternates: {
      canonical: absoluteSiteUrl(canonicalPath),
    },
    robots: {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    },
  };
}
