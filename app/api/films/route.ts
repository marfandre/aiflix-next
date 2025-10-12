import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')            // film id
    const upload_id = url.searchParams.get('upload_id')

    const supa = supabaseServer()
    let q = supa.from('films')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (id) q = q.eq('id', id)
    if (upload_id) q = q.eq('upload_id', upload_id)

    const { data, error } = await q
    if (error) throw error

    return NextResponse.json({ films: data ?? [] })
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? 'films GET failed' },
      { status: 500 }
    )
  }
}
