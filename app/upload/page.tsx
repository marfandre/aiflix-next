'use client';
import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type Tab = 'video' | 'image';

export default function UploadPage() {
  const supabase = createClientComponentClient();
  const [tab, setTab] = useState<Tab>('video');
  const [title, setTitle] = useState('');        // можно не заполнять
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = !!file && !loading;

  const onSubmit = async () => {
    if (!file) return alert('Выберите файл');

    setLoading(true);
    try {
      if (tab === 'image') {
        // 1) загрузим картинку в Storage (images)
        const filePath = `${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage
          .from('images')
          .upload(filePath, file, { upsert: false });
        if (upErr) throw upErr;

        const { data: pub } = await supabase.storage.from('images').getPublicUrl(filePath);

        // 2) внесём запись в films (название может быть пустым)
        const { error: insErr } = await supabase.from('films').insert({
          title: title || null,
          description: description || null,
          media_type: 'image',
          image_url: pub?.publicUrl ?? null,
          // другие поля по твоей схеме …
        });
        if (insErr) throw insErr;
        alert('Картинка загружена');
      } else {
        // tab === 'video'
        // Тут твоя текущая логика создания Mux Upload + запись в films.
        // Главное — не требовать сессии и не проверять пользователя.
        // Примерно так (сохраняя простоту):
        const { error: insErr } = await supabase.from('films').insert({
          title: title || null,
          description: description || null,
          media_type: 'video',
          // либо upload_id/asset_id, если создаёшь их в другом месте/вебхуком
        });
        if (insErr) throw insErr;
        alert('Видео добавлено');
      }
    } catch (e: any) {
      alert(e.message ?? 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto p-6">
      {/* табы */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('video')}  className={tab==='video' ? 'font-semibold' : ''}>Видео</button>
        <button onClick={() => setTab('image')}  className={tab==='image'? 'font-semibold' : ''}>Картинка</button>
      </div>

      {/* поля (не обязательные) */}
      <input placeholder="Название (необязательно)" value={title} onChange={e=>setTitle(e.target.value)} />
      <textarea placeholder="Описание (необязательно)" value={description} onChange={e=>setDescription(e.target.value)} />

      {/* файл обязателен */}
      <input type="file" accept={tab==='image' ? 'image/*' : 'video/mp4,video/webm'} onChange={e=>setFile(e.target.files?.[0] ?? null)} />

      <button disabled={!canSubmit} onClick={onSubmit}>
        {loading ? 'Загрузка…' : 'Загрузить'}
      </button>
    </main>
  );
}
