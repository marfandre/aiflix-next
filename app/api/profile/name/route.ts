// aiflix/app/api/profile/name/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function GET() {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ first_name: null, last_name: null });

  const { data } = await supa
    .from('profiles')
    .select('first_name,last_name')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.json({
    first_name: data?.first_name ?? null,
    last_name: data?.last_name ?? null
  });
}

export async function POST(req: Request) {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });

  const { first_name, last_name } = await req.json();
  const f = typeof first_name === 'string' ? first_name.trim() : null;
  const l = typeof last_name  === 'string' ? last_name.trim()  : null;

  if ((f && f.length > 64) || (l && l.length > 64)) {
    return NextResponse.json({ error: 'Длина имени/фамилии до 64 символов' }, { status: 400 });
  }

  const { error } = await supa
    .from('profiles')
    .upsert({ id: user.id, first_name: f, last_name: l }, { onConflict: 'id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
