'use client';

import Link from 'next/link';
import ProfileDropdown from './ProfileDropdown';
import NotificationBell from './NotificationBell';
import LanguageSwitcher from './LanguageSwitcher';
import { useT } from '@/lib/i18n/I18nProvider';

export default function Header() {
  const t = useT();

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur"
      style={{ backgroundColor: '#F8F9FB', borderBottom: '1px solid #9CA3AF' }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-2">
        <Link
          href="/"
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
            />
          </svg>
          <span className="text-sm font-medium">{t('header.home')}</span>
        </Link>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-0">
            <ProfileDropdown />
            <NotificationBell />
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}
