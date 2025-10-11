// app/api/videos/start/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // именно service role
);

const muxAuth =
  'Basic ' +
  Buffer.from(`${process.env.MUX_TOKEN_ID}:${process.env.MUX_TOKEN_SECRET}`).toString('base64');

export async function POST(req: Request) {
  try {
    const { title = 'Untitled', description = '' } = await req.json();

    // 1) сначала создаём фильм — чтобы получить film.id
    const { data: film, error: insErr } = await supabase
      .from('films')
      .insert({ title, description, status: 'uploading' })
      .select('id')
      .single();

    if (insErr || !film) throw new Error(insErr?.message || 'cannot insert film');

    // 2) создаём Direct Upload в Mux и привязываем external_id к film.id
    const upRes = await fetch('https://api.mux.com/video/v1/uploads', {
      method: 'POST',
      headers: { Authorization: muxAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        new_asset_settings: {
          playback_policy: ['public'],
          external_id: film.id, // 🔗 жёсткая связь с нашей строкой
        },
        cors_origin: '*',
      }),
    });

    if (!upRes.ok) {
      const t = await upRes.text();
      throw new Error(`Mux upload create failed: ${upRes.status} ${t}`);
    }

    const { data } = await upRes.json(); // { id: upload_id, url: upload_url }

    // 3) дописываем upload_id в тот же фильм
    const { error: updErr } = await supabase
      .from('films')
      .update({ upload_id: data.id })
      .eq('id', film.id);

    if (updErr) throw updErr;

    // 4) возвращаем URL для загрузки (туда фронт делает PUT файла)
    return NextResponse.json({
      film_id: film.id,
      upload_id: data.id,
      upload_url: data.url,
    });
  } catch (e: any) {
    console.error('[videos/start] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
