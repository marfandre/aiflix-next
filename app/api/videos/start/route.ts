// app/api/videos/start/route.ts
import { NextResponse } from 'next/server';
import Mux from '@mux/mux-node';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createService } from '@supabase/supabase-js';

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

export async function POST(req: Request) {
  try {
    const { title, description, model, genres, mood } = await req.json();

    // 1) Пользователь
    const supa = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userErr,
    } = await supa.auth.getUser();

    if (userErr) {
      console.error('videos/start auth.getUser error:', userErr);
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      );
    }

    // 2) Direct Upload в Mux
    const upload = await mux.video.uploads.create({
      cors_origin: process.env.NEXT_PUBLIC_SITE_URL ?? '*',
      new_asset_settings: {
        playback_policy: ['public'],
      },
      passthrough: JSON.stringify({
        user_id: user.id,
        title: title ?? null,
        model: model ?? null,
      }),
    });

    // 3) Сервисный Supabase
    const service = createService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const modelNorm =
      typeof model === 'string' && model.trim()
        ? model.trim().toLowerCase()
        : null;

    let genresToSave: string[] | null = null;
    if (Array.isArray(genres) && genres.length) {
      genresToSave = genres
        .map((g) => String(g).trim())
        .filter(Boolean)
        .slice(0, 10);
    }

    let moodToSave: string | null = null;
    if (typeof mood === 'string' && mood.trim().length > 0) {
      moodToSave = mood.trim().toLowerCase();
    }

    // 4) Создаём запись в films
    const { error: insError } = await service.from('films').insert({
      user_id: user.id,
      title: title ?? null,
      description: description ?? null,
      upload_id: upload.id,
      playback_id: null, // заполнит webhook
      model: modelNorm,
      genres: genresToSave,
      mood: moodToSave,
    });

    if (insError) {
      console.error('videos/start films insert error:', insError);
      // всё равно вернём URL — пусть видео загрузится в Mux
    }

    return NextResponse.json(
      { url: upload.url, uploadId: upload.id },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('videos/start fatal:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Mux start error' },
      { status: 500 }
    );
  }
}
