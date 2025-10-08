import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  const supa = supabaseServer()
  let q = supa.from('films').select('*').order('created_at', { ascending: false }).limit(50)
  if (id) q = q.eq('id', id)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ films: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supa = supabaseServer()
  const { data, error } = await supa
    .from('films')
    .insert({
      author_id: body.author_id ?? null,
      title: body.title,
      description: body.description,
      genres: body.genres ?? [],
      ai_models: body.ai_models ?? [],
      asset_id: body.asset_id,
      thumb_url: body.thumb_url ?? null
    })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ film: data })
}
