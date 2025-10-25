/** @type {import('next').NextConfig} */
import path from 'path';

const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['*'] },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'image.mux.com' },
    ],
  },
  webpack: (config) => {
    // Жёстко пробиваем алиас @ -> корень проекта
    config.resolve.alias['@'] = path.resolve(process.cwd());
    return config;
  },
};

export default nextConfig;
