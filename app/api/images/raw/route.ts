// aiflix/app/api/images/raw/route.ts
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

// Список возможных бакетов — перебираем, пока не найдём файл
const CANDIDATE_BUCKETS = ['images', 'public', 'ai', 'generated', 'image-outputs'];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.searchParams.get('path');

  if (!path) {
    return new Response('Missing "path"', { status: 400 });
  }

  // Если прислали абсолютный URL — просто редиректим на него.
  if (/^https?:\/\//i.test(path)) {
    return Response.redirect(path, 302);
  }

  const supa = createServerComponentClient({ cookies });

  // Перебор бакетов
  for (const bucket of CANDIDATE_BUCKETS) {
    try {
      const { data, error } = await supa.storage.from(bucket).download(path);
      if (error || !data) continue;

      // Грубое определение контента по расширению
      const lower = path.toLowerCase();
      const type =
        lower.endsWith('.png') ? 'image/png' :
        lower.endsWith('.webp') ? 'image/webp' :
        lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'image/jpeg' :
        lower.endsWith('.gif') ? 'image/gif' :
        'application/octet-stream';

      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': type,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch {
      // пробуем следующий бакет
      continue;
    }
  }

  // не нашли ни в одном бакете
  return new Response('Not found', { status: 404 });
}
