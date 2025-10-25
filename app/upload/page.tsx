'use client'
import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { MediaType } from '../_types/media'

export default function UploadPage() {
  const supabase = createClientComponentClient()
  const [mediaType, setMediaType] = useState<MediaType>('video')
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const disabled = !file || !title || loading

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Требуется войти в аккаунт')

      if (mediaType === 'image') {
        const ext = file.name.split('.').pop() || 'jpg'
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('images').upload(path, file, { upsert: false })
        if (upErr) throw upErr
        const { data: pub } = supabase.storage.from('images').getPublicUrl(path)
        const { error: insErr } = await supabase.from('films').insert({
          title, description,
          author_id: user.id,
          media_type: 'image',
          image_url: pub.publicUrl,
        })
        if (insErr) throw insErr
        alert('Картинка загружена!')
      } else {
        const res = await fetch('/api/videos/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description }),
        })
        if (!res.ok) throw new Error('Не удалось создать загрузку видео')
        const { uploadUrl } = await res.json()
        await fetch(uploadUrl, { method: 'PUT', body: file })
        alert('Видео загружено! Обработка может занять пару минут')
      }
      setFile(null); setTitle(''); setDescription('')
    } catch (err: any) {
      alert(err.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-2xl font-bold">Загрузка</h1>

      <div className="mt-4 flex justify-center">
        <div className="inline-flex rounded-2xl bg-gray-100 dark:bg-gray-800 p-1">
          {(['video','image'] as MediaType[]).map(t => (
            <button
              key={t}
              onClick={() => setMediaType(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium ${mediaType===t? 'bg-white dark:bg-gray-900 shadow':'opacity-70 hover:opacity-100'}`}
              type="button"
            >{t==='video'?'Видео':'Картинка'}</button>
          ))}
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium">Название</label>
          <input value={title} onChange={(e)=>setTitle(e.target.value)} className="mt-1 w-full rounded-xl border p-3 bg-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium">Описание</label>
          <textarea value={description} onChange={(e)=>setDescription(e.target.value)} className="mt-1 w-full rounded-xl border p-3 bg-transparent" rows={3} />
        </div>
        <div>
          <label className="block text-sm font-medium">Файл ({mediaType==='video'?'MP4/WEBM':'JPG/PNG/WebP'})</label>
          <input type="file" accept={mediaType==='video' ? 'video/*' : 'image/*'} onChange={(e)=>setFile(e.target.files?.[0] ?? null)} />
        </div>
        <button disabled={disabled} className="rounded-xl bg-black text-white px-5 py-3 disabled:opacity-50">
          {loading ? 'Загрузка...' : 'Загрузить'}
        </button>
      </form>
    </main>
  )
}
