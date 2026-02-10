'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import LikeButton from '@/app/components/LikeButton';

type ImageItem = {
    id: string;
    title: string;
    path: string;
    username: string;
    prompt?: string | null;
    description?: string | null;
    colors?: string[] | null;
    model?: string | null;
    mood?: string | null;
    image_type?: string | null;
    images_count?: number | null;
    created_at?: string | null;
};

type Props = {
    images: ImageItem[];
    currentUserId: string;
};

type ImageVariant = {
    path: string;
    colors: string[] | null;
    order_index: number | null;
};

const MODEL_LABELS: Record<string, string> = {
    sora: 'Sora',
    veo: 'Veo',
    'veo-2': 'Veo 2',
    'veo-3': 'Veo 3',
    'veo-3.1': 'Veo 3.1',
    midjourney: 'MidJourney',
    'stable diffusion xl': 'Stable Diffusion XL',
    'stable diffusion 3': 'Stable Diffusion 3',
    sdxl: 'SDXL',
    pika: 'Pika',
    runway: 'Runway',
    flux: 'Flux',
    dalle: 'DALL·E',
    'dalle 3': 'DALL·E 3',
    'dall-e': 'DALL·E',
    'dall-e 3': 'DALL·E 3',
    kandinsky: 'Kandinsky',
    leonardo: 'Leonardo',
};

function formatModelName(raw?: string | null): string {
    if (!raw) return 'не указана';
    const key = raw.toLowerCase();
    return MODEL_LABELS[key] ?? raw;
}

export default function FavoritesClient({ images, currentUserId }: Props) {
    const supabase = createClientComponentClient();

    const [selected, setSelected] = useState<ImageItem | null>(null);
    const [variants, setVariants] = useState<ImageVariant[]>([]);
    const [slideIndex, setSlideIndex] = useState(0);
    const [variantsLoading, setVariantsLoading] = useState(false);

    const publicImageUrl = (path: string | null) => {
        if (!path) return '/placeholder.png';
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }
        const { data } = supabase.storage.from('images').getPublicUrl(path);
        return data.publicUrl;
    };

    const handleCopyPrompt = async () => {
        const text = selected?.prompt || selected?.description;
        if (!text) return;
        try {
            if (typeof navigator === 'undefined' || !navigator.clipboard) return;
            await navigator.clipboard.writeText(text);
        } catch (e) {
            console.error('copy prompt error', e);
        }
    };

    const openImage = async (im: ImageItem) => {
        if (!im.path) return;

        const fallbackVariant: ImageVariant = {
            path: im.path,
            colors: (im.colors as string[] | null) ?? null,
            order_index: 0,
        };

        setSelected(im);
        setSlideIndex(0);
        setVariants([fallbackVariant]);
        setVariantsLoading(true);

        try {
            const { data, error } = await supabase
                .from('image_variants')
                .select('path, colors, order_index')
                .eq('image_meta_id', im.id)
                .order('order_index', { ascending: true });

            if (error) {
                console.error('load image_variants error:', error);
                setVariants([fallbackVariant]);
            } else if (data && data.length) {
                setVariants(
                    (data as any[]).map((v) => ({
                        path: v.path as string,
                        colors: (v.colors ?? null) as string[] | null,
                        order_index: (v.order_index ?? 0) as number | null,
                    }))
                );
            } else {
                setVariants([fallbackVariant]);
            }
        } finally {
            setVariantsLoading(false);
        }
    };

    const closeModal = () => {
        setSelected(null);
        setVariants([]);
        setSlideIndex(0);
        setVariantsLoading(false);
    };

    const currentVariant: ImageVariant | null =
        selected && variants.length ? variants[slideIndex] ?? variants[0] : null;

    const currentColors =
        currentVariant?.colors && currentVariant.colors.length
            ? currentVariant.colors
            : (selected?.colors as string[] | null) ?? [];

    const hasCarousel = !variantsLoading && variants.length > 1;

    if (images.length === 0) {
        return (
            <div className="text-center text-sm text-gray-500 py-12">
                Вы ещё не поставили лайк ни на одну картинку.
            </div>
        );
    }

    return (
        <>
            {/* Сетка картинок */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {images.map((im) => {
                    const url = publicImageUrl(im.path);
                    const imagesCount = typeof im.images_count === 'number' ? im.images_count : 1;
                    const showCarouselBadge = imagesCount > 1;

                    return (
                        <div
                            key={im.id}
                            className="overflow-hidden rounded-xl border bg-white shadow-sm"
                        >
                            <button
                                type="button"
                                onClick={() => openImage(im)}
                                className="relative block aspect-square w-full bg-gray-100"
                            >
                                <img
                                    src={url}
                                    alt={im.title}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                />
                                {showCarouselBadge && (
                                    <div className="absolute bottom-1 right-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
                                        {imagesCount}
                                    </div>
                                )}
                            </button>
                            <div className="p-3 flex items-center justify-between">
                                <span className="text-xs text-gray-500">@{im.username}</span>
                                <LikeButton
                                    target="image"
                                    id={im.id}
                                    userId={currentUserId}
                                    className="shrink-0"
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Модальное окно */}
            {selected && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
                    onClick={closeModal}
                >
                    <div
                        className="relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex flex-1 flex-col gap-4 p-4 md:flex-row">
                            {/* Левая колонка */}
                            <div className="mt-2 flex w-full flex-none flex-col justify-between gap-3 text-sm text-gray-700 md:w-[26rem]">
                                <div className="space-y-3">
                                    <div className="rounded-lg bg-gray-50 p-3">
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                                                Промт
                                            </span>
                                            <button
                                                type="button"
                                                onClick={handleCopyPrompt}
                                                disabled={!selected.prompt && !selected.description}
                                                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                                            >
                                                Скопировать
                                            </button>
                                        </div>
                                        {selected.prompt || selected.description ? (
                                            <p className="whitespace-pre-line text-xs text-gray-800">
                                                {selected.prompt || selected.description}
                                            </p>
                                        ) : (
                                            <p className="text-[11px] text-gray-400">Промт не указан.</p>
                                        )}
                                    </div>

                                    <div className="text-xs text-gray-600">
                                        Модель:{' '}
                                        <span className="font-medium">
                                            {formatModelName(selected.model || selected.image_type)}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="mt-4 border-t pt-2 text-xs text-gray-500">
                                        <Link
                                            href={`/u/${encodeURIComponent(selected.username)}`}
                                            className="font-medium text-gray-700 hover:underline"
                                        >
                                            @{selected.username}
                                        </Link>
                                        {selected.created_at && (
                                            <div className="mt-0.5">
                                                {new Date(selected.created_at).toLocaleDateString('ru-RU')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Правая колонка — изображение */}
                            <div className="flex flex-1 flex-col">
                                <div className="mb-2 flex items-center justify-center gap-1 md:justify-start">
                                    {Array.isArray(currentColors) &&
                                        currentColors.length > 0 &&
                                        currentColors.map((c, index) => {
                                            if (!c) return null;
                                            const base = 40;
                                            const step = 3;
                                            const size = Math.max(10, base - index * step);
                                            return (
                                                <div
                                                    key={c + index}
                                                    className="rounded-full border border-gray-200"
                                                    style={{
                                                        backgroundColor: c,
                                                        width: size,
                                                        height: size,
                                                    }}
                                                    title={c}
                                                />
                                            );
                                        })}
                                </div>

                                <div className="relative flex flex-1 items-center justify-center rounded-lg bg-gray-50">
                                    {currentVariant ? (
                                        <>
                                            <img
                                                src={publicImageUrl(currentVariant.path)}
                                                alt={selected.title}
                                                className="max-h-[80vh] w-full object-contain"
                                            />

                                            {hasCarousel && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setSlideIndex(
                                                                (i) => (i - 1 + variants.length) % variants.length
                                                            )
                                                        }
                                                        className="group absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 shadow-sm backdrop-blur-sm hover:bg-black/60"
                                                    >
                                                        <span className="block text-lg leading-none text-white">‹</span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setSlideIndex((i) => (i + 1) % variants.length)
                                                        }
                                                        className="group absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 shadow-sm backdrop-blur-sm hover:bg-black/60"
                                                    >
                                                        <span className="block text-lg leading-none text-white">›</span>
                                                    </button>

                                                    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
                                                        {variants.map((v, idx) => (
                                                            <button
                                                                key={v.path + idx}
                                                                type="button"
                                                                onClick={() => setSlideIndex(idx)}
                                                                className={`h-1.5 w-1.5 rounded-full ${idx === slideIndex ? 'bg-white' : 'bg-white/40'
                                                                    }`}
                                                            />
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-sm text-gray-500">Не удалось загрузить изображение.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
