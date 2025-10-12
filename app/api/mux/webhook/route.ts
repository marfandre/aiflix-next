// app/api/mux/webhook/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Создаем серверный клиент с правами записи (Service Role)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // важно: именно service role!
);

export async function POST(req: Request) {
  try {
    // Важно: для простоты диагностики берём JSON сразу
    const body = await req.json().catch(() => null);
    if (!body) {
      console.warn('MUX WEBHOOK: пустое тело');
      return NextResponse.json({ ok: false, error: 'empty body' }, { status: 200 });
    }

    const type = body?.type as string | undefined;
    console.log('MUX WEBHOOK type:', type);

    // Интересующие нас поля (будут у разных типов событий по-разному)
    const data = body?.data ?? {};
    const upload_id: string | undefined = data?.upload_id;
    const asset_id: string | undefined = data?.id; // id ассета Mux
    const playback_id: string | undefined = data?.playback_ids?.[0]?.id;

    // --- Основной happy-path: ассет готов, есть playback_id ---
    if (type === 'video.asset.ready') {
      console.log('asset.ready payload:', { upload_id, asset_id, playback_id });

      if (!upload_id && !asset_id) {
        console.warn('asset.ready без upload_id/asset_id — нечем матчить запись в films');
        return NextResponse.json({ ok: true, note: 'no identifiers' });
      }

      // Пытаемся обновить по upload_id, если он есть. Иначе — по asset_id.
      let query = supabase
        .from('films')
        .update({
          asset_id: asset_id ?? null,
          playback_id: playback_id ?? null,
          status: 'ready',
        })
        .select()
        .limit(1);

      if (upload_id) query = query.eq('upload_id', upload_id);
      else if (asset_id) query = query.eq('asset_id', asset_id);

      const { data: updated, error } = await query;

      if (error) {
        console.error('SUPABASE UPDATE ERROR:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
      }

      if (!updated || updated.length === 0) {
        console.warn('WEBHOOK: не нашли строку в films для обновления', { upload_id, asset_id });
      } else {
        console.log('WEBHOOK: обновили запись films:', updated[0]);
      }

      return NextResponse.json({ ok: true });
    }

    // --- Полезные дополнительные события (не обязательны, просто логируем/ставим статус) ---
    if (type === 'video.asset.errored') {
      console.error('MUX asset errored:', { upload_id, asset_id });
      if (upload_id || asset_id) {
        const { error } = await supabase
          .from('films')
          .update({ status: 'error' })
          .or(
            [
              upload_id ? `upload_id.eq.${upload_id}` : undefined,
              asset_id ? `asset_id.eq.${asset_id}` : undefined,
            ]
              .filter(Boolean)
              .join(',')
          );
        if (error) console.error('SUPABASE UPDATE (error status) FAILED:', error);
      }
      return NextResponse.json({ ok: true });
    }

    if (type === 'video.upload.created') {
      console.log('upload.created:', { upload_id });
      return NextResponse.json({ ok: true });
    }

    if (type === 'video.upload.cancelled') {
      console.warn('upload.cancelled:', { upload_id });
      if (upload_id) {
        const { error } = await supabase
          .from('films')
          .update({ status: 'cancelled' })
          .eq('upload_id', upload_id);
        if (error) console.error('SUPABASE UPDATE (cancelled) FAILED:', error);
      }
      return NextResponse.json({ ok: true });
    }

    // Неподдержанные типы просто логируем
    console.log('Unhandled Mux event:', type);
    return NextResponse.json({ ok: true, note: 'unhandled' });
  } catch (e: any) {
    console.error('WEBHOOK HANDLER ERROR:', e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || 'unknown' }, { status: 200 });
  }
}
