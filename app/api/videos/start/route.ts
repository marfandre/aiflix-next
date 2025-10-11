
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
  const { title = 'Untitled', description = '' } = await req.json();

  // 1) создаём Direct Upload в Mux
  const upRes = await fetch('https://api.mux.com/video/v1/uploads', {
    method: 'POST',
    headers: { Authorization: muxAuth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      new_asset_settings: {
        playback_policy: ['public'],
      },
      cors_origin: '*',
    }),
  });

  const { data } = await upRes.json(); // data.id = upload_id, data.url = upload_url

  // 2) создаём РОВНО ОДНУ запись фильма и запоминаем upload_id
  const { data: film, error } = await supabase
    .from('films')
    .insert({
      title,
      description,
      upload_id: data.id,
      status: 'uploading',
    })
    .select('id, upload_id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    film_id: film.id,
    upload_id: data.id,
    upload_url: data.url, // сюда фронт зальёт файл PUT'ом
  });
}
