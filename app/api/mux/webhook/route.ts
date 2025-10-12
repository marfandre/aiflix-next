import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = body?.type;

    console.log('[mux webhook] type:', type);

    if (type === 'video.asset.ready') {
      const assetId: string | undefined = body?.data?.id;
      const playbackId: string | undefined = body?.data?.playback_ids?.[0]?.id;
      const uploadId: string | undefined = body?.data?.upload_id;

      console.log('[mux webhook] payload:', { uploadId, assetId, playbackId });

      if (!uploadId || !playbackId) {
        console.log('[mux webhook] skip: missing ids');
        return NextResponse.json({ ok: true });
      }

      const supa = supabaseServer();
      const { data, error } = await supa
        .from('films')
        .update({
          asset_id: assetId ?? null,
          playback_id: playbackId,
          status: 'ready',
        })
        .eq('upload_id', uploadId)
        .select('id');

      if (error) {
        console.error('[mux webhook] update error:', error.message);
        return NextResponse.json({ ok: false }, { status: 500 });
      }

      console.log('[mux webhook] updated rows:', data?.length ?? 0);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[mux webhook] exception:', e?.message || e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
