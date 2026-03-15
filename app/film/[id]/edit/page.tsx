'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import TagSelector from '@/app/components/TagSelector';
import Link from 'next/link';

// Модели для видео
const VIDEO_MODELS = [
    { value: '', label: 'Выбрать' },
    { value: 'sora', label: 'Sora' },
    { value: 'veo', label: 'Veo' },
    { value: 'veo-2', label: 'Veo 2' },
    { value: 'veo-3', label: 'Veo 3' },
    { value: 'veo-3.1', label: 'Veo 3.1' },
    { value: 'pika', label: 'Pika' },
    { value: 'runway', label: 'Runway' },
    { value: 'kling', label: 'Kling' },
    { value: 'gen-3', label: 'Gen-3' },
    { value: 'midjourney', label: 'Midjourney' },
];

// Цветовая палитра
const COLOR_PALETTE = [
    { id: 'red', hex: '#FF1744', label: 'Красный' },
    { id: 'orange', hex: '#FF6D00', label: 'Оранжевый' },
    { id: 'yellow', hex: '#FFEA00', label: 'Жёлтый' },
    { id: 'green', hex: '#00E676', label: 'Зелёный' },
    { id: 'teal', hex: '#1DE9B6', label: 'Бирюзовый' },
    { id: 'cyan', hex: '#00E5FF', label: 'Голубой' },
    { id: 'blue', hex: '#2979FF', label: 'Синий' },
    { id: 'indigo', hex: '#651FFF', label: 'Индиго' },
    { id: 'purple', hex: '#D500F9', label: 'Фиолетовый' },
    { id: 'pink', hex: '#FF4081', label: 'Розовый' },
    { id: 'brown', hex: '#8D6E63', label: 'Коричневый' },
    { id: 'black', hex: '#121212', label: 'Чёрный' },
    { id: 'white', hex: '#FAFAFA', label: 'Белый' },
];

type PageProps = {
    params: { id: string };
};

export default function EditVideoPage({ params }: PageProps) {
    const router = useRouter();
    const supabase = createClientComponentClient();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [unauthorized, setUnauthorized] = useState(false);

    // Данные видео
    const [videoData, setVideoData] = useState<any>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [prompt, setPrompt] = useState('');
    const [model, setModel] = useState('');
    const [mood, setMood] = useState('');
    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
    const [colors, setColors] = useState<string[]>([]);

    // Загрузка данных видео
    useEffect(() => {
        (async () => {
            setLoading(true);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setUnauthorized(true);
                setLoading(false);
                return;
            }

            const { data: video, error: fetchError } = await supabase
                .from('films')
                .select('*')
                .eq('id', params.id)
                .single();

            if (fetchError || !video) {
                setNotFound(true);
                setLoading(false);
                return;
            }

            if (video.author_id !== user.id) {
                setUnauthorized(true);
                setLoading(false);
                return;
            }

            setVideoData(video);
            setTitle(video.title || '');
            setDescription(video.description || '');
            setPrompt(video.prompt || '');
            setModel(video.model || '');
            setMood(video.mood || '');
            setSelectedGenres(video.genres || []);
            setColors(video.colors || []);

            setLoading(false);
        })();
    }, [params.id, supabase]);

    // Сохранение изменений
    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setSaving(true);

        try {
            const res = await fetch('/api/videos/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: params.id,
                    title: title || null,
                    description: description || null,
                    prompt: prompt || null,
                    model: model || null,
                    genres: selectedGenres.length ? selectedGenres : null,
                    mood: mood || null,
                    colors: colors.length ? colors : null,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Ошибка при сохранении');
            }

            setSuccess('Изменения сохранены!');

            setTimeout(() => {
                router.back();
            }, 1000);
        } catch (err: any) {
            setError(err.message || 'Ошибка при сохранении');
        } finally {
            setSaving(false);
        }
    }

    function addColor(colorHex: string) {
        if (colors.includes(colorHex)) return;
        if (colors.length >= 5) return;
        setColors(prev => [...prev, colorHex]);
    }

    function removeColor(index: number) {
        setColors(prev => prev.filter((_, i) => i !== index));
    }

    if (loading) {
        return (
            <div className="mx-auto max-w-4xl p-6">
                <div className="py-10 text-gray-500">Загрузка...</div>
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="mx-auto max-w-4xl p-6">
                <div className="rounded-xl border bg-white p-6 text-center">
                    <h1 className="mb-4 text-2xl font-bold">Видео не найдено</h1>
                    <Link href="/" className="text-blue-600 hover:underline">
                        Вернуться на главную
                    </Link>
                </div>
            </div>
        );
    }

    if (unauthorized) {
        return (
            <div className="mx-auto max-w-4xl p-6">
                <div className="rounded-xl border bg-white p-6 text-center">
                    <h1 className="mb-4 text-2xl font-bold">Нет доступа</h1>
                    <p className="mb-4 text-gray-600">
                        Вы не можете редактировать это видео.
                    </p>
                    <Link href="/" className="text-blue-600 hover:underline">
                        Вернуться на главную
                    </Link>
                </div>
            </div>
        );
    }

    const posterUrl = videoData?.playback_id
        ? `https://image.mux.com/${videoData.playback_id}/thumbnail.jpg?time=1`
        : null;

    return (
        <div className="mx-auto max-w-6xl p-6">
            <h1 className="mb-6 text-2xl font-bold">Редактирование видео</h1>

            <div className="grid gap-10 md:grid-cols-[minmax(250px,320px)_1fr]">
                {/* Левая колонка — форма */}
                <form onSubmit={handleSubmit} className="space-y-5 pr-4">

                    {/* Промт */}
                    <div>
                        <label className="mb-1 block text-sm font-medium">Промт</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2"
                            rows={4}
                            placeholder="Промт, по которому было сгенерировано видео"
                        />
                    </div>

                    {/* Модель */}
                    <div>
                        <label className="mb-1 block text-sm font-medium">Модель</label>
                        <select
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className={`w-full rounded-lg border px-3 py-2 ${!model ? 'text-gray-400' : ''}`}
                        >
                            {VIDEO_MODELS.map((m) => (
                                <option
                                    key={m.value}
                                    value={m.value}
                                    className={m.value === '' ? 'text-gray-400' : 'text-gray-900'}
                                >
                                    {m.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Настроение */}
                    <div>
                        <label className="mb-1 block text-sm font-medium">Настроение</label>
                        <input
                            type="text"
                            value={mood}
                            onChange={(e) => setMood(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2"
                            placeholder="Например: cinematic, dreamy, dark..."
                        />
                    </div>

                    {/* Жанры (теги) */}
                    <div>
                        <label className="mb-1 block text-sm font-medium">Жанры</label>
                        <TagSelector
                            selectedTags={selectedGenres}
                            onTagsChange={setSelectedGenres}
                            maxTags={10}
                            placeholder="Введите жанр..."
                        />
                    </div>

                    {/* Ошибки и успех */}
                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                            {success}
                        </div>
                    )}

                    {/* Кнопки */}
                    <div className="flex gap-3">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 rounded-lg bg-black px-4 py-2 text-white transition hover:bg-gray-800 disabled:opacity-50"
                        >
                            {saving ? 'Сохранение...' : 'Сохранить'}
                        </button>
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="rounded-lg border px-4 py-2 transition hover:bg-gray-50"
                        >
                            Отмена
                        </button>
                    </div>
                </form>

                {/* Правая колонка — превью и цвета */}
                <div className="flex flex-col items-center">
                    {/* Превью видео */}
                    <div className="flex items-center justify-center">
                        {posterUrl ? (
                            <img
                                src={posterUrl}
                                alt={title || 'Видео'}
                                className="max-h-[60vh] w-auto max-w-full rounded-lg object-contain shadow-lg"
                            />
                        ) : (
                            <div className="flex h-48 w-full items-center justify-center rounded-lg bg-gray-100 text-gray-400">
                                Нет превью
                            </div>
                        )}
                    </div>

                    {/* Цвета под превью */}
                    <div className="mt-4 flex flex-col items-center">
                        <label className="mb-2 block text-xs font-medium text-gray-600">
                            Цвета ({colors.length}/5)
                        </label>
                        <div className="flex flex-wrap justify-center gap-2">
                            {colors.map((c, i) => (
                                <button
                                    key={c + i}
                                    type="button"
                                    onClick={() => removeColor(i)}
                                    className="group flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-md ring-2 ring-gray-300 transition-all duration-150"
                                    style={{ backgroundColor: c }}
                                    title="Удалить цвет"
                                >
                                    <span className="text-xs text-white drop-shadow-md opacity-0 transition-opacity group-hover:opacity-100">×</span>
                                </button>
                            ))}
                            {/* Пустые слоты */}
                            {Array.from({ length: 5 - colors.length }).map((_, i) => (
                                <div
                                    key={`empty-${i}`}
                                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-gray-400 text-gray-400"
                                >
                                    <span className="text-sm">+</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Палитра для выбора */}
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                        {COLOR_PALETTE.map((color) => {
                            const isSelected = colors.includes(color.hex);
                            const isDisabled = isSelected || colors.length >= 5;
                            return (
                                <button
                                    key={color.id}
                                    type="button"
                                    onClick={() => !isDisabled && addColor(color.hex)}
                                    disabled={isDisabled}
                                    className={`h-7 w-7 rounded-full border-2 transition ${isSelected
                                        ? 'border-gray-900 ring-2 ring-gray-400 opacity-50'
                                        : isDisabled
                                            ? 'opacity-30 cursor-not-allowed'
                                            : 'border-gray-200 hover:border-gray-400 hover:scale-110'
                                        }`}
                                    style={{ backgroundColor: color.hex }}
                                    title={isSelected ? `${color.label} (уже выбран)` : color.label}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
