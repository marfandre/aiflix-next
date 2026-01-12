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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="text-gray-900" style={{ backgroundColor: '#e5e7eb', fontFamily: 'Inter, sans-serif' }}>
        {/* Header / Navbar */}
        <header className="sticky top-0 z-40 backdrop-blur" style={{ backgroundColor: '#F8F9FB', borderBottom: '1px solid #9CA3AF' }}>
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-2">
            {/* Левый блок — Home */}
            <Link href="/" className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
              <span className="text-sm font-medium">Home</span>
            </Link>

            {/* Правый блок */}
            <div className="flex items-center gap-4">
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
