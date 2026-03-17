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
    const { title, description, prompt, model, seed, source, source_author, source_url, genres, mood, colors } = await req.json();

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
        // mp4_support требует определённый план Mux — используем GIF fallback
        passthrough: JSON.stringify({
          user_id: user.id,
          title: title ?? null,
          model: model ?? null,
        }),
      },
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

    const seedNorm =
      typeof seed === 'string' && seed.trim()
        ? seed.trim()
        : null;

    const sourceNorm =
      typeof source === 'string' && source.trim()
        ? source.trim().toLowerCase()
        : null;

    const sourceAuthorNorm =
      typeof source_author === 'string' && source_author.trim()
        ? source_author.trim()
        : null;

    const sourceUrlNorm =
      typeof source_url === 'string' && source_url.trim()
        ? source_url.trim()
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

    // Цвета из клиента
    let colorsToSave: string[] | null = null;
    if (Array.isArray(colors) && colors.length) {
      colorsToSave = colors
        .map((c: any) => String(c).trim())
        .filter(Boolean)
        .slice(0, 5);
    }

    // 4) Создаём запись в films
    const { error: insError } = await service.from('films').insert({
      author_id: user.id,  // ИСПРАВЛЕНО: было user_id, должно быть author_id
      title: title ?? null,
      description: description ?? null,
      prompt: prompt ?? null,
      upload_id: upload.id,
      playback_id: null, // заполнит webhook
      model: modelNorm,
      seed: seedNorm,
      source: sourceNorm,
      source_author: sourceAuthorNorm,
      source_url: sourceUrlNorm,
      genres: genresToSave,
      mood: moodToSave,
      colors: colorsToSave,
    });

    if (insError) {
      console.error('videos/start films insert error:', insError);
      return NextResponse.json(
        { error: `Database insert error: ${insError.message}` },
        { status: 500 }
      );
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
