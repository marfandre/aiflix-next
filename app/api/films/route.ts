// app/api/films/route.ts

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

// =======================
// GET /api/films
// =======================
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');          // film id
    const upload_id = url.searchParams.get('upload_id');

    const supa = supabaseServer();
    let q = supa
      .from('films')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (id) q = q.eq('id', id);
    if (upload_id) q = q.eq('upload_id', upload_id);

    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({ films: data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? 'films GET failed' },
      { status: 500 },
    );
  }
}

// =======================
// POST /api/films
// создаём фильм + сохраняем model
// =======================
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const title: string | null = body.title ?? null;
    const description: string | null = body.description ?? null;
    const playback_id: string | null = body.playback_id ?? null;
    const upload_id: string | null = body.upload_id ?? null;
    const model: string | null = body.model ?? null;

    if (!playback_id || !upload_id) {
      return NextResponse.json(
        { error: 'playback_id и upload_id обязательны' },
        { status: 400 },
      );
    }

    const supa = supabaseServer();

    // получаем пользователя
    const {
      data: { user },
      error: userErr,
    } = await supa.auth.getUser();

    if (userErr) {
      console.error('films POST auth error:', userErr);
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 },
      );
    }

    const modelNorm =
      typeof model === 'string' && model.trim()
        ? model.trim().toLowerCase()
        : null;

    const { data, error } = await supa
      .from('films')
      .insert([
        {
          user_id: user.id,
          title: title || null,
          description: description || null,
          playback_id,
          upload_id,
          model: modelNorm, // 👈 тут сохраняем модель
        },
      ])
      .select('id')
      .single();

    if (error || !data) {
      console.error('films POST insert error:', error);
      return NextResponse.json(
        { error: error?.message ?? 'films insert failed' },
        { status: 500 },
      );
    }

    return NextResponse.json({ id: data.id });
  } catch (e: any) {
    console.error('films POST fatal:', e);
    return NextResponse.json(
      { error: e.message ?? 'films POST failed' },
      { status: 500 },
    );
  }
}
