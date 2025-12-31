// aiflix/app/layout.tsx
import "./globals.css";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import ProfileDropdown from "./components/ProfileDropdown";
import NotificationBell from "./components/NotificationBell";

export const metadata: Metadata = {
  title: "WAIVA",
  description: "ИИ-контент",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="text-gray-900" style={{ backgroundColor: '#e5e7eb' }}>
        {/* Header / Navbar */}
        <header className="sticky top-0 z-40 backdrop-blur" style={{ backgroundColor: '#faf8f5', borderBottom: '1px solid #8b7355' }}>
          <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-5">
            <Link href="/" className="block transition-opacity hover:opacity-80" style={{ width: '160px', height: '40px', overflow: 'hidden' }}>
              <img src="/logo.png" alt="Waiva" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
            </Link>

            {/* Правый блок */}
            <div className="ml-auto flex items-center gap-4">
              <div className="flex items-center gap-0">
                <ProfileDropdown />
                <NotificationBell />
              </div>
              <Link href="/about" className="text-sm hover:underline">
                О проекте
              </Link>
            </div>
          </div>
        </header>

        {/* Контент страниц */}
        <main>{children}</main>
      </body>
    </html>
  );
}
