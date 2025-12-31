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
        <header className="sticky top-0 z-40 backdrop-blur" style={{ backgroundColor: '#F8F9FB', borderBottom: '1px solid #9CA3AF' }}>
          <div className="mx-auto flex max-w-7xl items-center justify-end gap-6 px-6 py-2">
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
