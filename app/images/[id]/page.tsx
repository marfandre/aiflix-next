// aiflix/app/images/[id]/page.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';

type Props = { params: { id: string } };

export const revalidate = 60;

function publicImageUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  return `${base}/storage/v1/object/public/images/${path}`;
}

const MODEL_LABELS: Record<string, string> = {
  midjourney: 'MidJourney',
  sdxl: 'SDXL',
  'sd-xl': 'SDXL',
  'stable diffusion xl': 'Stable Diffusion XL',
  'stable-diffusion-xl': 'Stable Diffusion XL',
  dalle: 'DALL\u00B7E',
  'dall-e': 'DALL\u00B7E',
  'dalle 3': 'DALL\u00B7E 3',
  'dall-e 3': 'DALL\u00B7E 3',
  'dall-e-3': 'DALL\u00B7E 3',
  flux: 'Flux',
  krea: 'KREA',
  sora: 'Sora',
  pika: 'Pika',
  runway: 'Runway',
  'gen-3': 'Gen-3',
  veo: 'Veo',
  'veo-2': 'Veo 2',
  'veo-3': 'Veo 3',
  'veo-3.1': 'Veo 3.1',
  kandinsky: 'Kandinsky',
  leonardo: 'Leonardo',
  ideogram: 'Ideogram',
  playground: 'Playground',
};

function formatModelName(raw?: string | null): string | null {
  if (!raw) return null;
  const key = raw.toLowerCase().trim();
  return MODEL_LABELS[key] ?? raw;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const year = date.getFullYear().toString().slice(-2);
  return `${month} ${year}`;
}

// OG metadata для шаринга
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

  const { data } = await supabase
    .from('images_meta')
    .select('path, title, prompt, model')
    .eq('id', params.id)
    .maybeSingle();

  if (!data) return { title: 'Image not found' };

  const title = (data.title ?? '').trim() || 'AI Image';
  const description = data.prompt ?? `AI-generated image${data.model ? ` by ${data.model}` : ''}`;
  const imageUrl = publicImageUrl(data.path);

  return {
    title: `${title} — Waiva`,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630 }],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function ImageViewByIdPage({ params }: Props) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

  const { data, error } = await supabase
    .from('images_meta')
    .select(
      'id, path, title, description, prompt, created_at, user_id, colors, accent_colors, model, tags, profiles:profiles(username, avatar_url)'
    )
    .eq('id', params.id)
    .maybeSingle();

  if (error || !data) return notFound();

  const title = (data.title ?? '').trim() || 'Картинка';
  const profiles = data.profiles as any;
  const nick = Array.isArray(profiles)
    ? profiles[0]?.username ?? 'Гость'
    : profiles?.username ?? 'Гость';
  const avatar = Array.isArray(profiles)
    ? profiles[0]?.avatar_url ?? null
    : profiles?.avatar_url ?? null;

  const url = publicImageUrl(data.path);
  const colors: string[] = (data as any).colors ?? [];
  const accentColors: string[] = ((data as any).accent_colors ?? []).filter((c: string) => c && c.trim());
  const modelLabel = formatModelName((data as any).model);
  const tags: string[] = (data as any).tags ?? [];
  const dateLabel = data.created_at ? formatDate(data.created_at) : null;

  return (
    <div className="min-h-screen bg-[#111] text-white">
      {/* Верхняя навигация */}
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link
          href="/?t=images"
          className="flex items-center gap-1.5 text-sm text-white/70 transition hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Назад
        </Link>
      </div>

      {/* Основной контент */}
      <div className="mx-auto max-w-6xl px-4 pb-12">
        <div className="flex items-start justify-center gap-4">

          {/* Цветовая палитра — слева */}
          {(colors.length > 0 || accentColors.length > 0) && (
            <div className="hidden sm:flex flex-col items-center gap-2 pt-4">
              {/* Акцентные цвета */}
              {accentColors.map((c, i) => (
                <div
                  key={`accent-${i}`}
                  className="rounded-full border-2 border-white/30 shadow-lg"
                  style={{ backgroundColor: c, width: 18, height: 18 }}
                  title={`Акцент: ${c}`}
                />
              ))}
              {/* Основные цвета */}
              {colors.map((c, i) => (
                <div
                  key={`color-${i}`}
                  className="rounded-full border border-white/30 shadow-lg"
                  style={{ backgroundColor: c, width: 28, height: 28 }}
                  title={c}
                />
              ))}
            </div>
          )}

          {/* Картинка + инфо-бар */}
          <div className="flex flex-col overflow-hidden rounded-lg shadow-2xl" style={{ maxWidth: 900 }}>
            {/* Картинка */}
            <div className="relative flex items-center justify-center bg-black">
              <img
                src={url}
                alt={title}
                className="max-h-[80vh] w-auto max-w-full object-contain"
              />
            </div>

            {/* Инфо-бар под картинкой — в стиле модалки */}
            <div className="bg-black/90 backdrop-blur-sm p-3 border-t border-white/20">
              <div className="flex flex-wrap items-center gap-4 text-xs text-white/80">

                {/* Дата */}
                {dateLabel && (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] text-white/50">{dateLabel}</span>
                  </div>
                )}

                {/* Автор */}
                <Link
                  href={`/u/${encodeURIComponent(nick)}`}
                  className="flex items-center gap-1.5 rounded-full px-2 py-0.5 transition hover:bg-white/20"
                >
                  {avatar && (
                    <img
                      src={avatar}
                      alt={nick}
                      className="h-4 w-4 rounded-full object-cover ring-1 ring-white/40"
                    />
                  )}
                  <span className="text-white">{nick}</span>
                </Link>

                {/* Модель */}
                {modelLabel && (
                  <span className="font-mono text-[11px] uppercase tracking-wider text-white/70">
                    {modelLabel}
                  </span>
                )}

                {/* Теги */}
                {tags.length > 0 && (
                  <>
                    {tags.slice(0, 4).map((tag) => {
                      let displayName = tag;
                      if (tag.endsWith(':en') || tag.endsWith(':ru')) {
                        displayName = tag.slice(0, -3);
                      }
                      return (
                        <span key={tag} className="rounded-full bg-white/20 px-2 py-0.5">
                          {displayName}
                        </span>
                      );
                    })}
                    {tags.length > 4 && (
                      <span className="text-white/60">+{tags.length - 4}</span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Мобильная палитра */}
            {(colors.length > 0) && (
              <div className="flex sm:hidden items-center justify-center gap-2 bg-black/80 py-2">
                {colors.map((c, i) => (
                  <div
                    key={`mob-${i}`}
                    className="rounded-full border border-white/40 shadow-md"
                    style={{ backgroundColor: c, width: 22, height: 22 }}
                    title={c}
                  />
                ))}
                {accentColors.map((c, i) => (
                  <div
                    key={`mob-accent-${i}`}
                    className="rounded-full border border-white/40 shadow-md"
                    style={{ backgroundColor: c, width: 16, height: 16 }}
                    title={c}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Описание / промпт (если есть) */}
        {(data.description || data.prompt) && (
          <div className="mx-auto mt-6 max-w-2xl rounded-lg bg-white/5 p-4 text-sm text-white/70">
            {data.prompt && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-white/40">Промпт</span>
                <p className="mt-1 whitespace-pre-line text-white/80">{data.prompt}</p>
              </div>
            )}
            {data.description && (
              <div className={data.prompt ? 'mt-3 border-t border-white/10 pt-3' : ''}>
                <span className="text-[10px] uppercase tracking-wider text-white/40">Описание</span>
                <p className="mt-1 whitespace-pre-line">{data.description}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
