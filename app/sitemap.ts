import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Статические страницы
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
  ];

  // Все изображения
  const { data: images } = await supabase
    .from('images_meta')
    .select('id, created_at')
    .order('created_at', { ascending: false })
    .limit(5000);

  const imagePages: MetadataRoute.Sitemap = (images ?? []).map((img) => ({
    url: `${BASE_URL}/images/${img.id}`,
    lastModified: img.created_at ? new Date(img.created_at) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Все видео
  const { data: videos } = await supabase
    .from('videos')
    .select('id, created_at')
    .order('created_at', { ascending: false })
    .limit(5000);

  const videoPages: MetadataRoute.Sitemap = (videos ?? []).map((v) => ({
    url: `${BASE_URL}/videos/${v.id}`,
    lastModified: v.created_at ? new Date(v.created_at) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...imagePages, ...videoPages];
}
