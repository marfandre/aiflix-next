// app/api/films/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

// GET /api/films            -> список (последние 50)
// GET /api/films?id=<uuid>  -> одна запись
export async function GET(req: NextRequest) {
  try {
    const supa = supabaseServer();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const { data, error } = await supa
        .from('films')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ film: data });
    }

    const { data, error } = await supa
      .from('films')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ films: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}

// Любые попытки создать фильм через /api/films запрещаем
export async function POST() {
  return NextResponse.json(
    { error: 'Create videos via /api/videos/start only' },
    { status: 405 }
  );
}
