// app/api/videos/start/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import Mux from '@mux/mux-node';

// Инициализация Mux (переменные должны быть заданы в Vercel)
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

// Даем безопасное дефолтное значение, если переменная не задана.
// ПОДСТАВЬ сюда свой прод-домен при необходимости.
const ORIGIN =
  process.env.NEXT_PUBLIC_BASE_URL ?? 'https://aiflix-next.vercel.app';

export async function POST(req: Request) {
  try {
    const { title = 'Untitled', description = '' } = await req.json();

    // 1) Создаем upload в Mux
    const upload = await mux.video.uploads.create({
      new_asset_settings: { playback_policy: ['public'] },
      cors_origin: ORIGIN, // <-- тут больше не будет ошибки типов
    });

    // 2) Сохраняем черновик фильма в Supabase со статусом "uploading"
    const supa = supabaseServer();
    const { data, error } = await supa
      .from('films')
      .insert({
        title,
        description,
        upload_id: upload.id,
        status: 'uploading',
      })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 3) Возвращаем фронту film_id, upload_id и upload_url
    return NextResponse.json(
      {
        film_id: data.id,
        upload_id: upload.id,
        upload_url: upload.url,
      },
      { status: 200 },
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'start failed' },
      { status: 500 },
    );
  }
}
