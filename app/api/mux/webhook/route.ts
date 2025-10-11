import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// (проверку подписи Mux можно добавить позже)

export async function POST(req: Request) {
  const evt = await req.json();
  const type = evt.type;

  if (type === 'video.asset.ready') {
    const assetId = evt.data.id;
    const uploadId = evt.data.upload_id;
    const playbackId = evt.data.playback_ids?.[0]?.id ?? null;

    const { error } = await supabase
      .from('films')
      .update({
        asset_id: assetId,
        playback_id: playbackId,
        status: 'ready',
      })
      .eq('upload_id', uploadId); // <-- КЛЮЧЕВАЯ СТРОКА: обновляем старую запись

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (type === 'video.asset.errored') {
    const uploadId = evt.data.upload_id;
    const msg = evt.data.errors?.[0]?.message ?? 'unknown';
    await supabase.from('films').update({ status: 'failed' }).eq('upload_id', uploadId);
  }

  return NextResponse.json({ ok: true });
}
