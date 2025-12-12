// app/about/page.tsx
import Link from "next/link";

export const metadata = {
  title: "О проекте — Waiva",
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/"
        className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center mb-6"
      >
        ← На главную
      </Link>

      <h1 className="text-3xl font-semibold mb-4">О проекте Waiva</h1>

      <p className="text-lg leading-relaxed text-gray-800 mb-3">
        Waiva — это платформа, которая объединяет AI-видео и изображения,
        созданные разными инструментами, от Midjourney до Sora в одном
        удобном пространстве.
      </p>
      <p className="text-lg leading-relaxed text-gray-800 mb-3">
        Здесь вы можете находить вдохновение, открывать новые визуальные
        направления и выражать себя через собственные работы.
      </p>
      <p className="text-lg leading-relaxed text-gray-800">
        Waiva делает мир AI-визуала понятным, красивым и лёгким для
        изучения.
      </p>
    </main>
  );
}
