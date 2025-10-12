// app/api/mux/webhook/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Если используешь проверку подписи Mux — оставь/добавь её здесь.
// Ниже — упрощённый вариант без валидации подписи, чтобы не мешал типам.

type MuxEvent = {
  type: string;
  data: any;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  // Чтобы не было «молчаливых» падений при билде
  throw new Error(
    'Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
  );
}

export async function POST(req: NextRequest) {
  try {
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const event = (await req.json()) as MuxEvent;

    // --- разбор полезной нагрузки Mux ---
    const { type, data } = event ?? {};
    // Mux обычно присылает:
    // - video.asset.created  -> data.id (asset_id), data.upload_id
    // - video.asset.ready    -> data.id (asset_id), data.playback_ids: [{id, policy}]
    // - video.upload.created -> data.id (upload_id)
    // см. https://docs.mux.com/docs/webhooks#event-types

    if (!type || !data) {
      return NextResponse.json({ ok: true, skipped: 'no-event' }, { status: 200 });
    }

    // Что будем писать в films
    const patch: Record<string, any> = {};

    if (type === 'video.asset.created') {
      // Прилетает связь upload_id <-> asset_id
      const asset_id: string | undefined = data?.id;
      const upload_id: string | undefined = data?.upload_id;

      if (!asset_id && !upload_id) {
        return NextResponse.json({ ok: true, skipped: 'no-ids' }, { status: 200 });
      }

      if (asset_id) patch.asset_id = asset_id;
      if (upload_id) patch.upload_id = upload_id;
      patch.status = 'processing';

      if (upload_id) {
        const { error } = await supa
          .from('films')
          .update(patch)
          .eq('upload_id', upload_id);

        if (error) throw error;
      } else if (asset_id) {
        const { error } = await supa
          .from('films')
          .update(patch)
          .eq('asset_id', asset_id);

        if (error) throw error;
      }

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (type === 'video.asset.ready') {
      // Когда asset готов — появляется playback_id
      const asset_id: string | undefined = data?.id;
      const playback_ids: Array<{ id: string; policy: string }> | undefined =
        data?.playback_ids;

      const playback_id = playback_ids?.[0]?.id;
      if (!asset_id && !playback_id) {
        return NextResponse.json({ ok: true, skipped: 'no-playback' }, { status: 200 });
      }

      if (playback_id) patch.playback_id = playback_id;
      patch.status = 'ready';

      const { error } = await supa
        .from('films')
        .update(patch)
        .eq('asset_id', asset_id as string);

      if (error) throw error;

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Другие события просто подтверждаем
    return NextResponse.json({ ok: true, ignored: type }, { status: 200 });
  } catch (e: any) {
    // Чтобы видеть, что именно упало, и не ловить «500 без сообщения»
    console.error('MUX webhook error:', e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'unknown' },
      { status: 200 } // отвечаем 200, чтобы Mux не ретраил бесконечно
    );
  }
}
