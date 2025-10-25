import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'IOWA',
  description: 'Видео и картинки',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        {/* Рантайм web-компонента <mux-player> */}
        <script
          defer
          src="https://cdn.jsdelivr.net/npm/@mux/mux-player@2/dist/mux-player.js"
        ></script>
      </head>
      <body className="min-h-screen">
        {/* ====== Шапка ====== */}
        <header className="border-b bg-white/80 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
            <Link href="/" className="font-semibold tracking-wide">IOWA</Link>
            <Link href="/upload" className="text-sm hover:underline">Загрузить</Link>
            <Link href="/about" className="text-sm hover:underline">О проекте</Link>

            <div className="ml-auto flex items-center gap-2">
              <input
                type="email"
                placeholder="email"
                className="h-8 rounded border px-3 text-sm"
              />
              <button className="h-8 rounded bg-black px-3 text-sm text-white">
                Войти
              </button>
            </div>
          </nav>
        </header>

        {/* ====== Контент ====== */}
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

        <footer className="py-8 text-center text-sm text-gray-500">© 2025 IOWA</footer>
      </body>
    </html>
  )
}
