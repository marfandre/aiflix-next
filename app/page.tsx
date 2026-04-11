// aiflix/app/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import HomeContent from "./components/HomeContent";

export default async function Home({
  searchParams,
}: {
  searchParams?: {
    t?: string;
    colors?: string;
    families?: string;
    models?: string;
    moods?: string;
    imageTypes?: string;
    tags?: string;
    aspect?: string;
  };
}) {
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
