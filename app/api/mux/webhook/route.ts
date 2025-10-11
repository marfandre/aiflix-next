// app/api/mux/webhook/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'; // на всякий случай

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Без проверки подписи, чтобы проще отладить. При необходимости добавим.
export async function POST(req: Request) {
  try {
    const evt = await req.json();
    const type = evt?.type;

    // интересуют успешные готовые ассеты
    if (type === 'video.asset.ready') {
      const assetId: string | undefined = evt?.data?.id;
      const uploadId: string | undefined = evt?.data?.upload_id;
      const playbackId: string | undefined = evt?.data?.playback_ids?.[0]?.id;
      const externalId: string | undefined = evt?.data?.external_id; // это film.id

      if (!assetId || !playbackId) {
        console.log('[mux webhook] no ids in event', evt);
        return NextResponse.json({ ok: false }, { status: 200 });
      }

      // 1) пробуем обновить по upload_id
      let { error: upErr } = await supabase
        .from('films')
        .update({ asset_id: assetId, playback_id: playbackId, status: 'ready' })
        .eq('upload_id', uploadId ?? '');

      // 2) если не нашлось — обновляем по external_id (film.id)
      if (upErr) console.log('[mux webhook] update by upload_id error', upErr);

      if (!upErr) {
        // всё ок по upload_id
        return NextResponse.json({ ok: true });
      }

      const { error: up2Err } = await supabase
        .from('films')
        .update({ asset_id: assetId, playback_id: playbackId, status: 'ready' })
        .eq('id', externalId ?? '');

      if (up2Err) {
        console.log('[mux webhook] update by external_id error', up2Err);
      }

      return NextResponse.json({ ok: true });
    }

    if (type === 'video.asset.errored') {
      const uploadId: string | undefined = evt?.data?.upload_id;
      const msg: string = evt?.data?.errors?.[0]?.message ?? 'unknown';
      await supabase.from('films').update({ status: 'failed', error: msg }).eq('upload_id', uploadId ?? '');
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[mux webhook] error:', e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
