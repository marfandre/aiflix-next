// aiflix/app/api/saved-palettes/check/route.ts
// Возвращает id сохранённой палитры для заданного источника, либо null.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function GET(req: Request) {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ id: null });

  const url = new URL(req.url);
  const source_type = url.searchParams.get('source_type');
  const source_id = url.searchParams.get('source_id');
  if ((source_type !== 'film' && source_type !== 'image') || !source_id) {
    return NextResponse.json({ id: null });
  }

  const { data } = await supa
    .from('saved_palettes')
    .select('id')
    .eq('source_type', source_type)
    .eq('source_id', source_id)
    .maybeSingle();

  return NextResponse.json({ id: data?.id ?? null });
}
