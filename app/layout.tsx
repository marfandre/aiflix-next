import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'IOWA',
  description: 'Видео и картинки',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        {/* Рантайм веб-компонента <mux-player> */}
        <script
          defer
          src="https://cdn.jsdelivr.net/npm/@mux/mux-player@2/dist/mux-player.js"
        ></script>
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
