// aiflix/app/page.tsx
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import HomeContent from "./components/HomeContent";
import { absoluteSiteUrl, noindexFollowMetadata } from "@/lib/seoMetadata";

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
  const isImagesTab = searchParams?.t === "images";
  const hasFilters = FILTER_PARAM_KEYS.some((key) => !!searchParams?.[key]);

  if (isImagesTab || hasFilters) {
    return noindexFollowMetadata("WAIVA", isImagesTab ? "/images" : "/");
  }

  return {
    title: {
      absolute: "WAIVA",
    },
    description: "Explore AI-generated images and videos with prompts, color palettes, models, creators, and visual discovery tools.",
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
      title: "WAIVA",
      description: "Explore AI-generated images and videos with prompts, color palettes, models, creators, and visual discovery tools.",
      url: absoluteSiteUrl("/"),
      siteName: "WAIVA",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "WAIVA",
      description: "Explore AI-generated images and videos with prompts, color palettes, models, creators, and visual discovery tools.",
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
