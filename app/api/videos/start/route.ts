import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import Mux from '@mux/mux-node';

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

export async function POST(req: Request) {
  try {
    const { title = 'Untitled', description = '' } = await req.json();

    const upload = await mux.video.uploads.create({
      new_asset_settings: { playback_policy: ['public'] },
      cors_origin: process.env.NEXT_PUBLIC_BASE_URL,
    });

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

    return NextResponse.json({
      film_id: data.id,
      upload_id: upload.id,
      upload_url: upload.url,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'start failed' }, { status: 500 });
  }
}
