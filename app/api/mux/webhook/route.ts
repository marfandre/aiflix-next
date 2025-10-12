// app/api/mux/webhook/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ВАЖНО: именно service role!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('MUX WEBHOOK type:', body?.type);

    if (body?.type === 'video.asset.ready') {
      const data = body?.data;
      const upload_id = data?.upload_id as string | undefined;
      const asset_id = data?.id as string | undefined;
      const playback_id = data?.playback_ids?.[0]?.id as string | undefined;

      console.log('asset_ready payload:', { upload_id, asset_id, playback_id });

      if (!upload_id) {
        console.warn('No upload_id in webhook — нечего матчить в films');
        return NextResponse.json({ ok: true, note: 'no upload_id' });
      }

      const { data: updated, error } = await supabase
        .from('films')
        .update({
          asset_id: asset_id ?? null,
          playback_id: playback_id ?? null,
          status: 'ready',
        })
        .eq('upload_id', upload_id)
        .select()
        .maybeSingle();

      if (error) {
        console.error('SUPABASE UPDATE ERROR:', error);
        return NextResponse.json({ ok: false, error }, { status: 200 });
      }

      if (!updated) {
        console.warn('No film row found for upload_id:', upload_id);
      } else {
        console.log('Updated film:', updated);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('WEBHOOK HANDLER ERROR:', e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || 'unknown' }, { status: 200 });
  }
}
