import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { type, data } = body
  if (type === 'video.asset.ready') {
    const { id: asset_id, playback_ids } = data
    const playback_id = playback_ids?.[0]?.id
    const supa = supabaseServer()
    await supa.from('films').update({ playback_id }).eq('asset_id', asset_id)
  }
  return NextResponse.json({ ok: true })
}
