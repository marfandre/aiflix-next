import { NextResponse } from 'next/server'
import Mux from '@mux/mux-node'
import { supabaseServer } from '@/lib/supabase-server'

// Аккуратно читаем переменные окружения, чтобы не падать на типах при билде
const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID ?? ''
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET ?? ''
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? undefined // для CORS у Mux

const mux = new Mux({
  tokenId: MUX_TOKEN_ID,
  tokenSecret: MUX_TOKEN_SECRET,
})

export async function POST(req: Request) {
  try {
    // 1) Получаем title/description из тела, никаких Untitled по умолчанию
    let payload: any = {}
    try {
      payload = await req.json()
    } catch {
      payload = {}
    }
    const rawTitle = typeof payload.title === 'string' ? payload.title : ''
    const rawDescription =
      typeof payload.description === 'string' ? payload.description : ''

    const title = rawTitle.trim()         // пустая строка, если не ввели
    const description = rawDescription.trim()

    // 2) Создаём upload в Mux
    const upload = await mux.video.uploads.create({
      new_asset_settings: { playback_policy: ['public'] },
      cors_origin: BASE_URL, // можно undefined, если переменной нет
    })

    // 3) Создаём запись в films (status = 'uploading')
    const supa = supabaseServer()
    const { data, error } = await supa
      .from('films')
      .insert({
        title,                // <- никаких 'Untitled'
        description,
        upload_id: upload.id,
        status: 'uploading',
      })
      .select('id')
      .single()

    if (error) throw error

    // 4) Возвращаем всё, что нужно фронту
    return NextResponse.json({
      film_id: data.id,
      upload_id: upload.id,
      upload_url: upload.url,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'start failed' },
      { status: 500 },
    )
  }
}
