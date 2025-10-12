// app/api/videos/start/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server'; // если у тебя путь другой, поправь
import Mux from '@mux/mux-node';

// Инициализация Mux (серверные ключи)
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

// POST /api/videos/start
export async function POST(req: NextRequest) {
  try {
    // 1) Парсим входящие данные
    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      description?: string;
    };

    const title = (body?.title ?? '').trim() || 'Untitled';
    const description = (body?.description ?? '').trim();

    // 2) Создаём upload в Mux
    // Чтобы не падал TypeScript на undefined, передаём cors_origin только если он есть
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;
    const upload = await mux.video.uploads.create({
      new_asset_settings: { playback_policy: ['public'] },
      ...(BASE_URL ? { cors_origin: BASE_URL } : {}),
    });

    const upload_id = upload.id;
    const upload_url = upload.url;

    // 3) Создаём запись в films (status = 'uploading')
    const supa = supabaseServer();
    const { data, error } = await supa
      .from('films')
      .insert({
        title,
        description,
        upload_id,
        status: 'uploading',
      })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // 4) Возвращаем клиенту служебные данные (id фильма, upload_id, upload_url)
    return NextResponse.json(
      {
        film_id: data?.id,
        upload_id,
        upload_url,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'start failed' },
      { status: 500 }
    );
  }
}
