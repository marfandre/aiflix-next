// aiflix/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Header from "./components/Header";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { getBaseUrl } from "@/lib/getBaseUrl";

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: "WAIVA",
    template: "%s | WAIVA",
  },
  description: "Explore AI-generated images and videos with prompts, color palettes, models, creators, and visual discovery tools.",
  creator: "WAIVA",
  publisher: "WAIVA",
  openGraph: {
    siteName: "WAIVA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="text-gray-900" style={{ backgroundColor: '#e5e7eb', fontFamily: 'Inter, sans-serif' }}>
        <I18nProvider>
          <Header />
          <main>{children}</main>
        </I18nProvider>
      </body>
    </html>
  );
}
