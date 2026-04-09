// aiflix/app/api/saved-palettes/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export async function GET() {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });

  const { data, error } = await supa
    .from('saved_palettes')
    .select('id, colors, title, source_type, source_id, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const rawColors = Array.isArray(body.colors) ? body.colors : [];
  const colors = rawColors
    .map((c: unknown) => (typeof c === 'string' ? c.trim() : ''))
    .filter((c: string) => HEX_RE.test(c))
    .map((c: string) => c.toLowerCase());

  if (colors.length === 0) return NextResponse.json({ error: 'Нет валидных цветов' }, { status: 400 });
  if (colors.length > 10) return NextResponse.json({ error: 'Максимум 10 цветов в палитре' }, { status: 400 });

  const title = typeof body.title === 'string' ? body.title.trim() || null : null;

  let source_type: 'film' | 'image' | null = null;
  let source_id: string | null = null;
  if (body.source_type === 'film' || body.source_type === 'image') {
    source_type = body.source_type;
    source_id = typeof body.source_id === 'string' ? body.source_id : null;
  }

  const { data, error } = await supa
    .from('saved_palettes')
    .insert({
      user_id: user.id,
      colors,
      title,
      source_type,
      source_id,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data.id });
}
