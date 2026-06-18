// lib/getBaseUrl.ts
const PRODUCTION_BASE_URL = 'https://www.waiva.art';

export function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') return PRODUCTION_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}
