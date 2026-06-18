import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getBaseUrl } from '@/lib/getBaseUrl';
import {
  aspectToPathSegment,
  humanizeLandingValue,
  normalizeLandingParam,
  pathSegmentToAspect,
  slugify,
} from './seoLinks';

export { aspectToPathSegment, pathSegmentToAspect, slugify } from './seoLinks';

export type LandingKind = 'tag' | 'model' | 'color' | 'aspect';

export type LandingConfig = {
  kind: LandingKind;
  value: string;
  label: string;
  title: string;
  description: string;
  canonicalPath: string;
  matchValues?: string[];
};

export type LandingImageRow = {
  id: string;
  path: string;
  title: string | null;
  description: string | null;
  prompt: string | null;
  created_at: string | null;
  user_id: string | null;
  colors: string[] | null;
  accent_colors: string[] | null;
  color_families: string[] | null;
  model: string | null;
  aspect_ratio: string | null;
  tags: string[] | null;
  profiles:
    | { username: string | null; avatar_url: string | null }[]
    | { username: string | null; avatar_url: string | null }
    | null;
};

const COLOR_LABELS: Record<string, string> = {
  red: 'red',
  orange: 'orange',
  yellow: 'yellow',
  green: 'green',
  teal: 'teal',
  cyan: 'cyan',
  blue: 'blue',
  indigo: 'indigo',
  purple: 'purple',
  pink: 'pink',
  mauve: 'mauve',
  peach: 'peach',
  brown: 'brown',
  black: 'black',
  white: 'white',
};

const MODEL_LABELS: Record<string, string> = {
  midjourney: 'Midjourney',
  sdxl: 'SDXL',
  'sd-xl': 'SDXL',
  'stable-diffusion-xl': 'Stable Diffusion XL',
  'stable diffusion xl': 'Stable Diffusion XL',
  dalle: 'DALL-E',
  'dall-e': 'DALL-E',
  'dall-e-3': 'DALL-E 3',
  'dalle-3': 'DALL-E 3',
  flux: 'Flux',
  krea: 'KREA',
  kandinsky: 'Kandinsky',
  leonardo: 'Leonardo',
  ideogram: 'Ideogram',
  playground: 'Playground',
};

function humanize(value: string): string {
  return humanizeLandingValue(value);
}

function titleCase(value: string): string {
  return humanize(value).replace(/\b[a-z]/g, (m) => m.toUpperCase());
}

export function absoluteUrl(path: string): string {
  const base = getBaseUrl().replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function publicImageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? '';
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${base}/storage/v1/object/public/images/${encodedPath}`;
}

export function getTagLanding(rawTag: string): LandingConfig {
  const value = normalizeLandingParam(rawTag);
  const label = titleCase(value);
  const baseValues = [
    value,
    value.replace(/-/g, '_'),
    value.replace(/-/g, ' '),
  ];
  const matchValues = baseValues.flatMap((tag) => [tag, `${tag}:en`, `${tag}:ru`]);

  return {
    kind: 'tag',
    value,
    label,
    matchValues: [...new Set(matchValues)],
    title: `${label} AI Images`,
    description: `Explore AI-generated images tagged ${label}, including prompts, models, palettes, and creators on WAIVA.`,
    canonicalPath: `/images/tags/${slugify(value)}`,
  };
}

export function getModelLanding(rawModel: string): LandingConfig {
  const value = normalizeLandingParam(rawModel);
  const label = MODEL_LABELS[value] ?? titleCase(value);
  const matchValues = [
    value,
    value.replace(/-/g, ' '),
    MODEL_LABELS[value]?.toLowerCase(),
  ].filter((item): item is string => !!item);

  return {
    kind: 'model',
    value,
    label,
    matchValues: [...new Set(matchValues)],
    title: `${label} AI Images`,
    description: `Browse AI images created with ${label}, with prompts, color palettes, aspect ratios, and creator profiles on WAIVA.`,
    canonicalPath: `/images/models/${slugify(value)}`,
  };
}

export function getColorLanding(rawColor: string): LandingConfig {
  const value = normalizeLandingParam(rawColor).replace(/\s+/g, '-');
  const label = COLOR_LABELS[value] ?? titleCase(value);

  return {
    kind: 'color',
    value,
    label,
    title: `${titleCase(label)} AI Images`,
    description: `Discover AI-generated images with ${label} palettes and color families, grouped for visual exploration on WAIVA.`,
    canonicalPath: `/images/colors/${slugify(value)}`,
  };
}

export function getAspectLanding(rawAspect: string): LandingConfig {
  const value = pathSegmentToAspect(rawAspect);
  const label = value;

  return {
    kind: 'aspect',
    value,
    label,
    title: `${label} AI Images`,
    description: `Browse ${label} AI-generated images on WAIVA, with prompts, models, tags, and color palettes.`,
    canonicalPath: `/images/aspect/${aspectToPathSegment(value)}`,
  };
}

export function buildLandingMetadata(config: LandingConfig): Metadata {
  const canonical = absoluteUrl(config.canonicalPath);
  const keywords = [
    config.label,
    `${config.label} AI images`,
    `${config.label} AI art`,
    'AI image gallery',
    'AI art',
    'WAIVA',
  ];

  return {
    metadataBase: new URL(getBaseUrl()),
    title: config.title,
    description: config.description,
    keywords,
    alternates: { canonical },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
      },
    },
    openGraph: {
      title: config.title,
      description: config.description,
      url: canonical,
      siteName: 'WAIVA',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: config.title,
      description: config.description,
    },
  };
}

function applyLandingFilter(query: any, config: LandingConfig) {
  if (config.kind === 'tag') {
    return query.overlaps('tags', config.matchValues ?? [config.value]);
  }

  if (config.kind === 'model') {
    const values = (config.matchValues ?? [config.value])
      .map((value) => value.replace(/[%,()]/g, '').trim())
      .filter(Boolean);
    if (!values.length) return query;
    return query.or(values.map((value) => `model.ilike.%${value}%`).join(','));
  }

  if (config.kind === 'color') {
    return query.contains('color_families', [config.value]);
  }

  return query.eq('aspect_ratio', config.value);
}

export async function fetchLandingImages(config: LandingConfig, limit = 120): Promise<LandingImageRow[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  let query = supabase
    .from('images_meta')
    .select('id, path, title, description, prompt, created_at, user_id, colors, accent_colors, color_families, model, aspect_ratio, tags, profiles(username, avatar_url)')
    .not('path', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  query = applyLandingFilter(query, config);

  const { data, error } = await query;
  if (error) {
    console.error(`image landing fetch error (${config.kind}:${config.value}):`, error);
    return [];
  }

  return ((data ?? []) as LandingImageRow[]).filter((image) => !!image.path);
}
