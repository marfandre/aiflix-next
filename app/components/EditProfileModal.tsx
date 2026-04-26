'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useT } from '@/lib/i18n/I18nProvider';
import Avatar from './Avatar';

type Props = {
  className?: string;
  label?: string;
  initialFirst: string;
  initialLast: string;
  initialAvatarUrl: string;
  initialBio: string;
  initialUsername: string;
};

export default function EditProfileModal({
  className,
  label,
  initialFirst,
  initialLast,
  initialAvatarUrl,
  initialBio,
  initialUsername,
}: Props) {
  const supabase = createClientComponentClient();
  const t = useT();
  const triggerLabel = label ?? t('profile.editLabel');

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // поля формы
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [bio, setBio] = useState(initialBio);
  const [username, setUsername] = useState(initialUsername);

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

      const trimmedUsername = username.trim();
      const usernameChanged = trimmedUsername !== initialUsername.trim();
      if (usernameChanged && (trimmedUsername.length < 2 || trimmedUsername.length > 32)) {
        setError(t('profile.usernameLengthError'));
        setSaving(false);
        return;
      }

      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error(t('profile.userResolveFailed'));

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

      const updates: Record<string, unknown> = {
        first_name: firstName,
        last_name: lastName,
        bio,
        avatar_url: newAvatarUrl,
      };
      if (usernameChanged) updates.username = trimmedUsername;

      const { error: updErr } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (updErr) {
        // Postgres unique violation для username
        if (updErr.code === '23505' || /unique|duplicate/i.test(updErr.message)) {
          throw new Error(t('profile.usernameTaken'));
        }
        throw updErr;
      }

      setOpen(false);
      // Если ник поменяли — URL /u/[old] устарел, переходим на новый.
      if (typeof window !== 'undefined') {
        if (usernameChanged) {
          window.location.href = `/u/${encodeURIComponent(trimmedUsername)}`;
        } else {
          window.location.reload();
        }
      }
    } catch (e: any) {
      setError(e?.message || t('profile.saveErrorGeneric'));
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
        {triggerLabel}
      </button>

      {!open ? null : (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
            {/* Контент модалки со скроллом, чтобы не уползала вниз */}
            <div className="max-h-[85vh] overflow-auto p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">{t('profile.editTitle')}</h3>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100"
                  aria-label={t('common.close')}
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
                <Avatar
                  src={previewUrl}
                  name={[initialFirst, initialLast].filter(Boolean).join(' ').trim() || initialUsername}
                  size={64}
                  ringClassName="ring-1 ring-gray-200"
                />
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium">{t('profile.newAvatarLabel')}</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {t('profile.avatarOptionalHint')}
                  </p>
                </div>
              </div>

              {/* Ник */}
              <div className="mb-3">
                <label className="mb-1 block text-sm">{t('profile.usernameLabel')}</label>
                <div className="flex items-center rounded border px-3 py-2 focus-within:ring-1 focus-within:ring-gray-400">
                  <span className="text-gray-400 select-none">@</span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t('profile.usernamePlaceholder')}
                    minLength={2}
                    maxLength={32}
                    className="flex-1 bg-transparent outline-none ml-1"
                  />
                </div>
              </div>

              {/* Имя */}
              <div className="mb-3">
                <label className="mb-1 block text-sm">{t('profile.firstName')}</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded border px-3 py-2"
                />
              </div>

              {/* Фамилия */}
              <div className="mb-3">
                <label className="mb-1 block text-sm">{t('profile.lastName')}</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded border px-3 py-2"
                />
              </div>

              {/* О себе */}
              <div>
                <label className="mb-1 block text-sm">{t('profile.bioLabel')}</label>
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
                  {t('common.cancel')}
                </button>
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                  {saving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
