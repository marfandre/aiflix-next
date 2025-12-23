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
    <div className="mx-auto max-w-[2000px] px-4 py-8">
      <div className="mb-14 flex justify-center">
        <MediaTabs />
      </div>

      {tab === "video" && (
        <div className="overflow-hidden rounded-2xl">
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {(videos as any[]).map((v) => {
              const p = Array.isArray(v.profiles) ? v.profiles[0] : v.profiles;
              const nick: string = p?.username ?? "user";
              const avatar: string | null = p?.avatar_url ?? null;

              const title = (v.title ?? "").trim() || "Без названия";
              const href = `/film/${v.id}`;

              return (
                <div key={v.id} className="group relative">
                  {/* Основная ссылка — только картинка */}
                  <Link
                    href={href}
                    className="relative block aspect-[4/5] w-full bg-gray-100 overflow-hidden"
                  >
                    <img
                      src={muxPoster(v.playback_id ?? null)}
                      alt={title}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                    {/* Иконка видео */}
                    <div className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white flex items-center gap-1">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </Link>

                  {/* Overlay с автором — вне Link */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <Link
                      href={`/u/${encodeURIComponent(nick)}`}
                      className="pointer-events-auto flex items-center gap-1.5 rounded-full px-2 py-1 text-white transition hover:bg-white/20"
                    >
                      {avatar && (
                        <img
                          src={avatar}
                          alt={nick}
                          className="h-[18px] w-[18px] shrink-0 rounded-full object-cover ring-1 ring-white/40"
                        />
                      )}
                      <span className="truncate text-[11px] font-medium drop-shadow-md">
                        {nick}
                      </span>
                    </Link>
                  </div>

                  {/* Кнопка лайка — вне Link */}
                  <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="pointer-events-auto">
                      <LikeButton
                        target="film"
                        id={v.id}
                        userId={userId}
                        ownerId={v.user_id}
                        className="text-white drop-shadow-md"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
