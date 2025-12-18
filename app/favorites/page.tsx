// app/favorites/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import FavoritesTabs from './FavoritesTabs';
import FavoritesClient from './FavoritesClient';
import LikeButton from '@/app/components/LikeButton';

type PageProps = { searchParams?: { t?: string } };
type Tab = 'video' | 'images';

const muxPoster = (playback_id?: string | null) =>
    playback_id
        ? `https://image.mux.com/${playback_id}/thumbnail.jpg?time=1&fit_mode=preserve`
        : '/placeholder.png';

export default async function FavoritesPage({ searchParams }: PageProps) {
    const supabase = createServerComponentClient({ cookies });
    const tab: Tab = searchParams?.t === 'images' ? 'images' : 'video';

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Не авторизован — редирект на главную
    if (!user) {
        redirect('/');
    }

    // Получаем лайки пользователя
    const { data: likes } = await supabase
        .from('likes')
        .select('film_id, image_id')
        .eq('user_id', user.id);

    const likedFilmIds = (likes ?? []).filter((l) => l.film_id).map((l) => l.film_id as string);
    const likedImageIds = (likes ?? []).filter((l) => l.image_id).map((l) => l.image_id as string);

    // Загружаем видео
    let videos: any[] = [];
    if (tab === 'video' && likedFilmIds.length > 0) {
        const { data: films } = await supabase
            .from('films')
            .select('id, title, playback_id, created_at, user_id, profiles(username)')
            .in('id', likedFilmIds)
            .order('created_at', { ascending: false });

        videos = (films ?? []).map((v: any) => ({
            id: v.id,
            title: v.title || 'Без названия',
            playback_id: v.playback_id,
            username: v.profiles?.username || 'unknown',
        }));
    }

    // Загружаем картинки
    let images: any[] = [];
    if (tab === 'images' && likedImageIds.length > 0) {
        const { data: imgs } = await supabase
            .from('images_meta')
            .select('id, title, path, created_at, user_id, prompt, description, colors, model, mood, image_type, images_count, profiles(username)')
            .in('id', likedImageIds)
            .order('created_at', { ascending: false });

        images = (imgs ?? []).map((im: any) => ({
            id: im.id,
            title: im.title || 'Без названия',
            path: im.path,
            username: im.profiles?.username || 'unknown',
            prompt: im.prompt,
            description: im.description,
            colors: im.colors,
            model: im.model,
            mood: im.mood,
            image_type: im.image_type,
            images_count: im.images_count,
            created_at: im.created_at,
        }));
    }

    return (
        <div className="mx-auto max-w-6xl p-4 sm:p-6">
            {/* Заголовок */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Понравилось ❤️</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Контент, на который вы поставили лайк
                </p>
            </div>

            {/* Вкладки */}
            <div className="mb-6 flex justify-center">
                <FavoritesTabs />
            </div>

            {/* Видео */}
            {tab === 'video' && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {videos.map((v) => (
                        <div
                            key={v.id}
                            className="overflow-hidden rounded-xl border bg-white shadow-sm"
                        >
                            <Link href={`/film/${v.id}`} className="block relative aspect-video bg-black">
                                <img
                                    src={muxPoster(v.playback_id)}
                                    alt={v.title}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                />
                            </Link>
                            <div className="p-3 flex items-center justify-between">
                                <div className="text-xs text-gray-500">@{v.username}</div>
                                <LikeButton
                                    target="film"
                                    id={v.id}
                                    userId={user.id}
                                    className="shrink-0"
                                />
                            </div>
                        </div>
                    ))}

                    {videos.length === 0 && (
                        <div className="col-span-full text-center text-sm text-gray-500 py-12">
                            Вы ещё не поставили лайк ни на одно видео.
                        </div>
                    )}
                </div>
            )}

            {/* Картинки */}
            {tab === 'images' && (
                <FavoritesClient images={images} currentUserId={user.id} />
            )}
        </div>
    );
}
