// aiflix/app/images/[id]/page.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

type Props = { params: { id: string } };

export const revalidate = 60;

function publicImageUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  return `${base}/storage/v1/object/public/images/${path}`;
}

export default async function ImageViewByIdPage({ params }: Props) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

  // Загружаем картинку + палитру + модель + жанры/атмосферу/тип
  const { data, error } = await supabase
    .from('images_meta')
    .select(
      'id, path, title, created_at, user_id, colors, model, genres, mood, image_type, profiles:profiles(username)'
    )
    .eq('id', params.id)
    .maybeSingle();

  if (error || !data) return notFound();

  const title = (data.title ?? '').trim() || 'Картинка';
  const nick =
    Array.isArray(data.profiles)
      ? data.profiles[0]?.username ?? 'Гость'
      : data.profiles?.username ?? 'Гость';

  const url = publicImageUrl(data.path);
  const dateStr = new Date(data.created_at).toLocaleDateString('ru-RU');

  // ---- Цвета ----
  const rawColors = (data as any).colors as string[] | null | undefined;
  const colors: string[] = rawColors ?? [];

  // ---- Модель ----
  const rawModel = (data as any).model as string | null | undefined;
  const modelKey = rawModel ? String(rawModel).toLowerCase() : null;

  const MODEL_LABELS: Record<string, string> = {
    midjourney: 'Midjourney',
    sdxl: 'SDXL',
    'sd-xl': 'SDXL',
    dalle: 'DALL·E',
    'dall-e': 'DALL·E',
    flux: 'Flux',
    krea: 'KREA',
    sora: 'Sora',
    pika: 'Pika',
    runway: 'Runway',
    'gen-3': 'Gen-3',
  };

  const modelLabel = modelKey ? MODEL_LABELS[modelKey] ?? rawModel ?? null : null;

  // ---- Жанры ----
  const rawGenres = (data as any).genres as string[] | null | undefined;
  const genres: string[] = Array.isArray(rawGenres)
    ? rawGenres.filter((g) => !!g && g.trim().length > 0)
    : [];

  // ---- Атмосфера / настроение ----
  const rawMood = (data as any).mood as string | null | undefined;
  const moodLabel = rawMood ? rawMood.trim() : null;

  // ---- Тип изображения ----
  const rawImageType = (data as any).image_type as string | null | undefined;
  const imageTypeLabel = rawImageType ? rawImageType.trim() : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-4">
      {/* Навигация */}
      <div className="mt-2 mb-4 flex items-center justify-between">
        <Link
          href="/images"
          className="text-sm px-3 py-1.5 rounded border hover:bg-gray-50"
        >
          ← Назад к картинкам
        </Link>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm px-3 py-1.5 rounded border hover:bg-gray-50"
        >
          Открыть оригинал
        </a>
      </div>

      {/* Картинка */}
      <div className="flex justify-center mt-2">
        <img
          src={url}
          alt={title}
          className="max-h-[65vh] w-auto max-w-full object-contain shadow-sm"
        />
      </div>

      {/* Палитра + модель */}
      {(colors.length > 0 || modelLabel) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-5">
          {/* кружочки цветов */}
          {colors.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {colors.map((c, index) => {
                const base = 32;
                const step = 4;
                const size = Math.max(16, base - index * step);

                return (
                  <div
                    key={c + index}
                    className="rounded-full border border-gray-200"
                    style={{
                      backgroundColor: c,
                      width: size,
                      height: size,
                    }}
                    title={c}
                  />
                );
              })}
            </div>
          )}

          {/* модель справа от цветов */}
          {modelLabel && (
            <span className="text-sm text-gray-600 whitespace-nowrap">
              Модель:{' '}
              <span className="font-medium">
                {modelLabel}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Жанры / атмосфера / тип */}
      {(genres.length > 0 || moodLabel || imageTypeLabel) && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-gray-600">
          {genres.length > 0 && (
            <span>
              Жанры:{' '}
              <span className="font-medium">
                {genres.join(', ')}
              </span>
            </span>
          )}

          {moodLabel && (
            <span>
              Атмосфера:{' '}
              <span className="font-medium">
                {moodLabel}
              </span>
            </span>
          )}

          {imageTypeLabel && (
            <span>
              Тип:{' '}
              <span className="font-medium">
                {imageTypeLabel}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Заголовок, автор, дата */}
      <div className="mt-4">
        <div className="text-lg font-semibold">{title}</div>

        <div className="text-sm text-gray-500 mt-1 flex items-center gap-3">
          <span>@{nick}</span>
          <span>•</span>
          <span>{dateStr}</span>
        </div>
      </div>
    </div>
  );
}
