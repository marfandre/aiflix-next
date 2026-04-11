/** @type {import('next').NextConfig} */
import path from 'path';

const SEMANTIC_SEARCH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_SEMANTIC_SEARCH === '1';

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
    // При выключенном семантическом поиске выкидываем тяжёлые ML-пакеты
    // из трейса всех лямбд. Это реальная экономия на Vercel (~150+MB).
    ...(SEMANTIC_SEARCH_ENABLED
      ? {}
      : {
          outputFileTracingExcludes: {
            '*': [
              'node_modules/@huggingface/**',
              'node_modules/onnxruntime-node/**',
              'node_modules/onnxruntime-web/**',
              'node_modules/onnxruntime-common/**',
            ],
          },
        }),
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

    // Семантический поиск включается флагом NEXT_PUBLIC_ENABLE_SEMANTIC_SEARCH=1.
    // Если флаг не стоит (Vercel prod), подменяем lib/localEmbedding на stub,
    // чтобы @huggingface/transformers + onnxruntime-node не попали в трейс лямбды.
    if (process.env.NEXT_PUBLIC_ENABLE_SEMANTIC_SEARCH !== '1') {
      const stubPath = path.resolve(process.cwd(), 'lib/localEmbeddingStub.ts');
      config.resolve.alias['@/lib/localEmbedding'] = stubPath;
      config.resolve.alias['@/lib/localEmbedding.ts'] = stubPath;
    }

    return config;
  },
};

export default nextConfig;
