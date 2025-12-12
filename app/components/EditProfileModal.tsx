'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type Props = {
  className?: string;
  label?: string;                 // текст на кнопке-триггере (по умолчанию — "Редактировать")
  initialFirst: string;
  initialLast: string;
  initialAvatarUrl: string;       // текущий URL аватара из БД
  initialBio: string;
};

export default function EditProfileModal({
  className,
  label = 'Редактировать',
  initialFirst,
  initialLast,
  initialAvatarUrl,
  initialBio,
}: Props) {
  const supabase = createClientComponentClient();

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // поля формы
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [bio, setBio] = useState(initialBio);

  // текущий аватар
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);

  // новый файл аватара
  const [file, setFile] = useState<File | null>(null);

  // предпросмотр
  const previewUrl = useMemo(() => {
    if (file) return URL.createObjectURL(file);
    return avatarUrl || '/placeholder.png';
  }, [file, avatarUrl]);

  useEffect(() => {
    if (!open) return;
    setError(null);
  }, [open]);

  async function onSave() {
    try {
      setSaving(true);
      setError(null);

      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error('Не удалось определить пользователя');

      let newAvatarUrl = avatarUrl; // по умолчанию — оставляем прежний

      // если выбран новый файл — грузим его
      if (file) {
        const bucket = 'avatars'; // имя публичного бакета с аватарами
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${user.id}/${Date.now()}.${ext}`;

        const { error: upErr } = await supabase
          .storage
          .from(bucket)
          .upload(path, file, {
            upsert: true,
            contentType: file.type || 'image/*',
          });
        if (upErr) throw upErr;

        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
        newAvatarUrl = pub.publicUrl;
      }

      const { error: updErr } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          bio,
          avatar_url: newAvatarUrl,
        })
        .eq('id', user.id);

      if (updErr) throw updErr;

      setOpen(false);
      // Перезагрузим, чтобы сразу увидеть изменения
      if (typeof window !== 'undefined') window.location.reload();
    } catch (e: any) {
      setError(e?.message || 'Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Кнопка-триггер */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          'rounded-full bg-white px-4 py-1.5 text-sm font-semibold shadow ring-1 ring-gray-200 hover:bg-gray-50'
        }
      >
        {label}
      </button>

      {!open ? null : (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
            {/* Контент модалки со скроллом, чтобы не уползала вниз */}
            <div className="max-h-[85vh] overflow-auto p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Редактирование профиля</h3>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100"
                  aria-label="Закрыть"
                >
                  ✕
                </button>
              </div>

              {error && (
                <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Аватар + загрузка файла */}
              <div className="mb-4 flex items-center gap-4">
                <img
                  src={previewUrl}
                  alt="avatar preview"
                  className="h-16 w-16 rounded-full object-cover ring-1 ring-gray-200"
                />
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium">Новый аватар (PNG/JPG)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Можно не выбирать файл — тогда останется текущий аватар.
                  </p>
                </div>
              </div>

              {/* Имя */}
              <div className="mb-3">
                <label className="mb-1 block text-sm">Имя</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded border px-3 py-2"
                />
              </div>

              {/* Фамилия */}
              <div className="mb-3">
                <label className="mb-1 block text-sm">Фамилия</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded border px-3 py-2"
                />
              </div>

              {/* О себе */}
              <div>
                <label className="mb-1 block text-sm">О себе</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={5}
                  className="w-full rounded border px-3 py-2"
                />
              </div>

              {/* Кнопки действий */}
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="rounded border px-4 py-2 text-sm"
                >
                  Отмена
                </button>
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
