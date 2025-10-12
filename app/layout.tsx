import './globals.css'
import Link from 'next/link'
import AuthButton from '@/components/AuthButton'

export const metadata = { title: 'IOWA — AI‑фильмы', description: 'Платформа для AI‑фильмов (MVP)' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <header className="border-b">
          <div className="max-w-6xl mx-auto p-4 flex items-center gap-6 justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="font-bold">IOWA</Link>
              <nav className="text-sm text-gray-600 flex gap-4">
                <Link href="/upload">Загрузить</Link>
                <Link href="/about">О проекте</Link>
              </nav>
            </div>
            <AuthButton />
          </div>
        </header>
        <main>{children}</main>
        <footer className="border-t mt-10">
          <div className="max-w-6xl mx-auto p-4 text-sm text-gray-500">© {new Date().getFullYear()} IOWA</div>
        </footer>
      </body>
    </html>
  )
}
