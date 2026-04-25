'use client';

import { useT } from '@/lib/i18n/I18nProvider';

export function ProfileNotFound() {
  const t = useT();
  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="rounded-xl border bg-white p-6 text-center shadow-sm">
        {t('profile.notFound')}
      </div>
    </div>
  );
}

export function ProfileFallbackName() {
  const t = useT();
  return <>{t('profile.fallback')}</>;
}

export function ProfileUploadCta() {
  const t = useT();
  return <>{t('profile.uploadCta')}</>;
}

export function ProfileEditLabelClient(): string {
  return useT()('profile.editLabel');
}
