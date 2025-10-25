// app/_types/media.ts
export type MediaType = 'video' | 'image'

export type Film = {
  id: string
  title: string | null
  description: string | null
  created_at: string
  author_id: string
  media_type: MediaType
  // видео
  playback_id?: string | null
  asset_id?: string | null
  // изображение
  image_url?: string | null
  image_width?: number | null
  image_height?: number | null
}
