'use client';

import { useT } from '@/lib/i18n/I18nProvider';

export function FavoritesHeader() {
  const t = useT();
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold">{t('favorites.heading')}</h1>
      <p className="mt-1 text-sm text-gray-500">{t('favorites.subheading')}</p>
    </div>
  );
}

export function FavoritesEmptyVideos() {
  const t = useT();
  return (
    <div className="col-span-full text-center text-sm text-gray-500 py-12">
      {t('favorites.emptyVideos')}
    </div>
  );
}
