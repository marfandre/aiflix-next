// aiflix/app/layout.tsx
import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import ProfileDropdown from "./components/ProfileDropdown";

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
      <body className="bg-white text-gray-900">
        {/* Header / Navbar */}
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
          <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-5">
            {/* Логотип/бренд слева */}
            <Link href="/" className="text-xl font-extrabold tracking-wide">
              WAIVA
            </Link>

            {/* Левые пункты навигации */}
            <nav className="flex items-center gap-6">
              <Link href="/about" className="text-sm hover:underline">
                О проекте
              </Link>
            </nav>

            {/* Правый блок */}
            <div className="ml-auto flex items-center gap-2">
              <ProfileDropdown />
            </div>
          </div>
        </header>

        {/* Контент страниц */}
        <main>{children}</main>
      </body>
    </html>
  );
}
