// aiflix/app/api/saved-prompts/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function GET() {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });

  const { data, error } = await supa
    .from('saved_prompts')
    .select('id, prompt, negative_prompt, model, seed, aspect_ratio, params, source_type, source_id, note, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return NextResponse.json({ error: 'Пустой промт' }, { status: 400 });
  if (prompt.length > 8000) return NextResponse.json({ error: 'Слишком длинный промт' }, { status: 400 });

  const negative_prompt = typeof body.negative_prompt === 'string' ? body.negative_prompt.trim() || null : null;
  const model           = typeof body.model === 'string'           ? body.model.trim() || null           : null;
  const seed            = body.seed != null ? String(body.seed).trim() || null                            : null;
  const aspect_ratio    = typeof body.aspect_ratio === 'string'    ? body.aspect_ratio.trim() || null    : null;
  const note            = typeof body.note === 'string'            ? body.note.trim() || null            : null;
  const params          = body.params && typeof body.params === 'object' ? body.params : null;

  let source_type: 'film' | 'image' | null = null;
  let source_id: string | null = null;
  if (body.source_type === 'film' || body.source_type === 'image') {
    source_type = body.source_type;
    source_id = typeof body.source_id === 'string' ? body.source_id : null;
  }

  // Дедуп: если уже сохранён промт из этого источника — вернём существующий id.
  if (source_type && source_id) {
    const { data: existing } = await supa
      .from('saved_prompts')
      .select('id')
      .eq('user_id', user.id)
      .eq('source_type', source_type)
      .eq('source_id', source_id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ ok: true, id: existing.id, already: true });
    }
  }

  const { data, error } = await supa
    .from('saved_prompts')
    .insert({
      user_id: user.id,
      prompt,
      negative_prompt,
      model,
      seed,
      aspect_ratio,
      params,
      note,
      source_type,
      source_id,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data.id });
}
