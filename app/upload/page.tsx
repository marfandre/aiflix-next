// app/upload/page.tsx  (клиентский компонент)
'use client'

import { useState } from 'react'

export default function UploadPage() {
  const [title, setTitle] = useState('')            // было: 'Untitled'
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [msg, setMsg] = useState<string>('')

  async function handleUpload() {
    if (!file) { setMsg('Выберите файл'); return }

    setMsg('Создаём upload в Mux…')

    // 1) стартуем на сервере: создадим upload в Mux и строку в films
    const start = await fetch('/api/videos/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title || undefined, description })
    }).then(r => r.json())

    if (start.error) { setMsg('Ошибка: ' + start.error); return }

    const { film_id, upload_url } = start

    // 2) заливаем сам файл в Mux (PUT)
    setMsg('Загружаем файл в Mux…')
    const put = await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    })
    if (!put.ok) { setMsg('Ошибка загрузки в Mux: ' + put.status); return }

    // 3) ждём playback_id по film_id — ПУЛЛИНГ
    setMsg('Обработка на Mux… ждём playback_id')

    const ok = await waitForPlaybackIdByFilmId(film_id)
    setMsg(ok ? 'Готово! 🎬' : 'Не дождались playback_id за отведённое время')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Загрузить видео</h1>

      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Название"
        className="border p-2 w-full"
      />

      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Необязательное описание"
        className="border p-2 w-full h-32"
      />

      <input
        type="file"
        accept="video/*"
        onChange={e => setFile(e.target.files?.[0] ?? null)}
      />

      <button
        onClick={handleUpload}
        disabled={!file}
        className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
      >
        Обработать
      </button>

      <div className="text-sm text-gray-600">{msg}</div>
    </div>
  )
}

async function waitForPlaybackIdByFilmId(filmId: string) {
  // опрашиваем API по id строки в films (а не по upload_id)
  for (let i = 0; i < 90; i++) {            // ~3 мин, шаг 2 сек
    await new Promise(r => setTimeout(r, 2000))
    const res = await fetch(`/api/films?id=${filmId}`).then(r => r.json())
    const f = res.films?.[0]
    if (f?.playback_id) return true
  }
  return false
}
