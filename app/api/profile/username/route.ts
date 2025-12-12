// aiflix/app/api/profile/username/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function GET() {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ username: null });

  const { data } = await supa
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.json({ username: data?.username ?? null });
}

export async function POST(req: Request) {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });

  const { username } = await req.json();
  // простая валидация
  if (typeof username !== 'string' || username.trim().length < 2 || username.length > 32) {
    return NextResponse.json({ error: 'Ник от 2 до 32 символов' }, { status: 400 });
  }

  // upsert своей записи
  const { error } = await supa
    .from('profiles')
    .upsert({ id: user.id, username: username.trim() }, { onConflict: 'id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
