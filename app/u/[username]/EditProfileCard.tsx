'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type Props = {
  initialFirst: string;
  initialLast: string;
  initialAvatarUrl?: string | null;
  initialBio: string;
  variant?: 'default' | 'inline';
};

export default function EditProfileCard({
  initialFirst,
  initialLast,
  initialAvatarUrl,
  initialBio,
  variant = 'default',
}: Props) {
  const supabase = createClientComponentClient();

  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [bio, setBio] = useState(initialBio ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Оборачиваем и кнопку, и панель в один контейнер — клики ВНУТРИ него не закрывают панель
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Закрытие по клику вне контейнера
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!open) return;
      const target = e.target as Node;
      if (containerRef.current && containerRef.current.contains(target)) return; // клик внутри — игнор
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const count = bio?.length ?? 0;
  const disabled = saving || count > 280;

  const triggerClass =
    variant === 'inline'
      ? 'inline-flex items-center rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-50 active:bg-gray-100 shadow-sm transition'
      : 'inline-flex items-center rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 transition';

  const preview = useMemo(() => {
    if (file) return URL.createObjectURL(file);
    return avatarUrl ?? null;
  }, [file, avatarUrl]);

  async function uploadAvatar(userId: string): Promise<string | null> {
    if (!file) return avatarUrl ?? null;

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });
    if (upErr) throw upErr;

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl ?? null;
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const { data: { user }, error: uerr } = await supabase.auth.getUser();
      if (uerr) throw uerr;
      if (!user) throw new Error('Не удалось определить пользователя');

      const newAvatar = await uploadAvatar(user.id);

      const { error: updErr } = await supabase
        .from('profiles')
        .update({
          first_name: firstName || null,
          last_name: lastName || null,
          bio: bio || null,
          avatar_url: newAvatar,
        })
        .eq('id', user.id);

      if (updErr) throw updErr;

      setAvatarUrl(newAvatar ?? null);
      setFile(null);
      setOpen(false);
    } catch (e: any) {
      setError(e?.message ?? 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  function onCancel() {
    setFirstName(initialFirst);
    setLastName(initialLast);
    setBio(initialBio ?? '');
    setFile(null);
    setOpen(false);
    setError(null);
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Триггер */}
      <button
        type="button"
        className={triggerClass}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="edit-profile-panel"
      >
        {open ? 'Скрыть' : 'Редактировать профиль'}
      </button>

      {/* Всплывающая панель (absolute) */}
      {open && (
        <div
          id="edit-profile-panel"
          className="absolute right-0 top-full z-20 mt-2 w-[420px] max-w-[90vw] rounded-2xl border bg-white p-4 shadow-lg"
        >
          <div className="grid grid-cols-1 gap-3">
            {/* Имя / Фамилия с подписями */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="firstName" className="mb-1 block text-xs font-medium text-gray-600">
                  Имя
                </label>
                <input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Имя"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="lastName" className="mb-1 block text-xs font-medium text-gray-600">
                  Фамилия
                </label>
                <input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Фамилия"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>
            </div>

            {/* Краткое описание с подписью и счётчиком */}
            <div>
              <label htmlFor="bio" className="mb-1 block text-xs font-medium text-gray-600">
                Краткое описание
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 280))}
                placeholder="О себе (до 280 символов)"
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
              />
              <div className={`mt-1 text-xs ${count > 280 ? 'text-red-600' : 'text-gray-500'}`}>
                {count}/280
              </div>
            </div>

            {/* Аватар */}
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-full ring-1 ring-gray-300 bg-gray-100 shrink-0">
                {preview && <img src={preview} alt="avatar preview" className="h-full w-full object-cover" />}
              </div>
              <div className="text-sm">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <div className="mt-1 text-xs text-gray-500">
                  Загрузите квадратное изображение (рекомендуется ≥ 256×256).
                </div>
              </div>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={onSave}
                disabled={disabled}
                className="inline-flex items-center rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center rounded-lg border px-4 py-2 text-sm"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
