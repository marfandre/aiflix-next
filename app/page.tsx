// aiflix/app/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";

import MediaTabs from "./components/MediaTabs";
import ImageFeedClient from "./components/ImageFeedClient";
import LikeButton from "./components/LikeButton";

type Tab = "video" | "images";

function muxPoster(playback_id: string | null) {
  return playback_id
    ? `https://image.mux.com/${playback_id}/thumbnail.jpg?time=1`
    : "/placeholder.png";
}

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

  const videos =
    tab === "video"
      ? await supabase
          .from("films")
          .select(
            "id, user_id, title, description, playback_id, created_at, profiles!inner(username, avatar_url)"
          )
          .order("created_at", { ascending: false })
          .limit(60)
          .then((r) => r.data ?? [])
      : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex justify-center">
        <MediaTabs />
      </div>

      {tab === "video" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(videos as any[]).map((v) => {
            const p = Array.isArray(v.profiles) ? v.profiles[0] : v.profiles;
            const nick: string = p?.username ?? "user";
            const avatar: string | null = p?.avatar_url ?? null;

            const title = (v.title ?? "").trim() || "Без названия";
            const href = `/film/${v.id}`;

            return (
              <div
                key={v.id}
                className="overflow-hidden rounded-xl border bg-white shadow-sm ring-1 ring-gray-100"
              >
                <Link
                  href={href}
                  className="block relative aspect-video bg-black"
                >
                  <img
                    src={muxPoster(v.playback_id ?? null)}
                    alt={title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </Link>

                <div className="px-4 py-3">
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <Link
                      href={`/u/${encodeURIComponent(nick)}`}
                      className="flex items-center gap-2 min-w-0 hover:underline"
                    >
                      {avatar && (
                        <img
                          src={avatar}
                          alt={nick}
                          className="h-5 w-5 shrink-0 rounded-full ring-1 ring-gray-300 object-cover"
                        />
                      )}
                      <span className="truncate">@{nick}</span>
                    </Link>

                    <LikeButton
                      target="film"
                      id={v.id}
                      userId={userId}
                      className="ml-auto shrink-0"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
