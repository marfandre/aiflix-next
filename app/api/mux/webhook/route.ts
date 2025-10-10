// app/api/mux/webhook/route.ts
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Нам нужно только событие "видео готово"
    if (body.type !== 'video.asset.ready') {
      return new Response('ignored', { status: 200 })
    }

    const asset = body.data
    const playbackId = asset?.playback_ids?.[0]?.id ?? null

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // именно Service Role Key
    )

    const { error } = await supabase.from('films').insert({
      title: asset.passthrough?.title ?? 'Untitled',
      description: asset.passthrough?.description ?? '',
      asset_id: asset.id,
      playback_id: playbackId,
      thumb_url: asset.static_renditions?.thumbnail?.url ?? null,
      created_at: new Date().toISOString(),
    })

    if (error) {
      console.error('Supabase insert error:', error)
      return new Response('Database error', { status: 500 })
    }

    console.log('✅ Saved asset to Supabase:', asset.id)
    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response('Internal error', { status: 500 })
  }
}

// Чтобы прямой заход GET'ом не рушил логи, вернём 405
export async function GET() {
  return new Response('Method Not Allowed', { status: 405 })
}
