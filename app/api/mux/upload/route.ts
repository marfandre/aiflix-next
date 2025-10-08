import { NextResponse } from 'next/server'
import { video } from '@/lib/mux'

function mask(s?: string) {
  if (!s) return '—'
  return s.slice(0,4) + '…' + s.slice(-4)
}

export async function POST() {
  try {
    if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
      throw new Error('MUX credentials are missing')
    }
    const upload = await video.uploads.create({
      cors_origin: '*',
      new_asset_settings: { playback_policy: ['public'] }
    })
    return NextResponse.json({ uploadUrl: upload.url, uploadId: upload.id })
  } catch (e: any) {
    const msg = e?.message || String(e)
    console.error('MUX upload create error:', msg)
    return NextResponse.json({
      error: msg,
      env: {
        TOKEN_ID: mask(process.env.MUX_TOKEN_ID),
        TOKEN_SECRET: mask(process.env.MUX_TOKEN_SECRET)
      }
    }, { status: 500 })
  }
}

// оставим GET для отладки
export const GET = POST
