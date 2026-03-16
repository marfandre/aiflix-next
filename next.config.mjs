/** @type {import('next').NextConfig} */
import path from 'path';

const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['*'] },
    serverComponentsExternalPackages: [
      '@huggingface/transformers',
      'onnxruntime-node',
      'sharp',
      'node-vibrant',
      '@vibrant/core',
      '@vibrant/image',
      '@vibrant/image-node',
      '@vibrant/color',
      '@vibrant/generator',
      '@vibrant/generator-default',
      '@vibrant/quantizer',
      '@vibrant/quantizer-mmcq',
      '@vibrant/types',
      '@jimp/custom',
      '@jimp/plugin-resize',
      '@jimp/types',
      'color-namer',
    ],
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
