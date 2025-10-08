'use client'
import { useState } from 'react'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleUpload() {
    if (!file) return
    setLoading(true)

    const r = await fetch('/api/mux/upload', { method: 'POST' })
    const { uploadUrl, uploadId } = await r.json()

    await fetch(uploadUrl, { method: 'PUT', body: file })

    await fetch('/api/films', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, ai_models: [], genres: [], asset_id: uploadId })
    })

    setLoading(false)
    alert('Фильм загружен! Обработка займёт несколько минут.')
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Загрузить AI‑фильм</h1>
      <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <input className="w-full border p-2 rounded" placeholder="Название" value={title} onChange={e=>setTitle(e.target.value)} />
      <textarea className="w-full border p-2 rounded" placeholder="Описание" value={description} onChange={e=>setDescription(e.target.value)} />
      <button disabled={loading} onClick={handleUpload} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50">
        {loading ? 'Загрузка…' : 'Опубликовать'}
      </button>
    </div>
  )
}
