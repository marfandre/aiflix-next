// aiflix/app/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import MediaTabs from "./components/MediaTabs";
import ImageFeedClient from "./components/ImageFeedClient";
import VideoFeedClient from "./components/VideoFeedClient";

type Tab = "video" | "images";

export default async function Home({
  searchParams,
}: {
  searchParams?: {
    t?: string;
    colors?: string;
    models?: string;
    moods?: string;
    imageTypes?: string;
  };
}) {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  const tab: Tab = searchParams?.t === "images" ? "images" : "video";

  return (
    <div className="mx-auto max-w-[2000px] px-4 py-8">
      <div className="mb-14 flex justify-center">
        <MediaTabs />
      </div>

      {tab === "video" && <VideoFeedClient userId={userId} />}

      {tab === "images" && (
        <ImageFeedClient
          userId={userId}
          searchParams={{
            colors: searchParams?.colors,
            models: searchParams?.models,
            moods: searchParams?.moods,
            imageTypes: searchParams?.imageTypes,
          }}
        />
      )}
    </div>
  );
}

