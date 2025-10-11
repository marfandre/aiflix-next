// app/api/films/[id]/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // если чтение публичное по RLS — можно использовать anon key.
  // Если нет — используй только на сервере service role key:
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(
  _req: Request,
  ctx: { params: { id: string } }
) {
  const { id } = ctx.params

  const { data, error } = await supabase
    .from('films')
    .select(
      'id,title,description,playback_id,asset_id,thumb_url,visibility,ai_models,genres,tools,created_at,updated_at'
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Film not found' }, { status: 404 })
  }

  return NextResponse.json(data, { status: 200 })
}
