'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import clsx from 'clsx'

const tabs = [
  { key: 'video', label: 'Видео' },
  { key: 'image', label: 'Картинки' },
] as const

export default function MediaTabs() {
  const sp = useSearchParams()
  const type = sp.get('type') ?? 'video'
  return (
    <div className="w-full flex justify-center mt-4">
      <div className="inline-flex rounded-2xl bg-gray-100 dark:bg-gray-800 p-1">
        {tabs.map(t => (
          <Link
            key={t.key}
            href={`/?type=${t.key}`}
            className={clsx(
              'px-4 py-2 rounded-xl text-sm font-medium transition',
              type === t.key ? 'bg-white dark:bg-gray-900 shadow' : 'opacity-70 hover:opacity-100'
            )}
            prefetch
          >
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
