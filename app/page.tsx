// aiflix/app/page.tsx
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import HomeContent from "./components/HomeContent";
import { absoluteSiteUrl, noindexFollowMetadata } from "@/lib/seoMetadata";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TITLE } from "@/lib/siteSeo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type HomeSearchParams = {
  t?: string;
  colors?: string;
  families?: string;
  models?: string;
  moods?: string;
  imageTypes?: string;
  tags?: string;
  aspect?: string;
};

type HomeProps = {
  searchParams?: HomeSearchParams;
};

const FILTER_PARAM_KEYS: Array<keyof HomeSearchParams> = [
  "colors",
  "families",
  "models",
  "moods",
  "imageTypes",
  "tags",
  "aspect",
];

export async function generateMetadata({ searchParams }: HomeProps): Promise<Metadata> {
  const hasTabParam = searchParams?.t === "images" || searchParams?.t === "video";
  const hasFilters = FILTER_PARAM_KEYS.some((key) => !!searchParams?.[key]);

  if (hasTabParam || hasFilters) {
    return noindexFollowMetadata(SITE_TITLE, "/");
  }

  return {
    title: {
      absolute: SITE_TITLE,
    },
    description: SITE_DESCRIPTION,
    keywords: SITE_KEYWORDS,
    alternates: {
      canonical: absoluteSiteUrl("/"),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
      },
    },
    openGraph: {
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      url: absoluteSiteUrl("/"),
      siteName: SITE_NAME,
      type: "website",
      images: [{ url: absoluteSiteUrl("/logo.png"), alt: SITE_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: [absoluteSiteUrl("/logo.png")],
    },
  };
}

export default async function Home({ searchParams }: HomeProps) {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  return (
    <HomeContent
      userId={userId}
      searchParams={{
        colors: searchParams?.colors,
        families: searchParams?.families,
        models: searchParams?.models,
        moods: searchParams?.moods,
        imageTypes: searchParams?.imageTypes,
        tags: searchParams?.tags,
        aspect: searchParams?.aspect,
      }}
    />
  );
}
