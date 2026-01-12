'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import TagSelector from '@/app/components/TagSelector';
import Link from 'next/link';

// Модели для картинок
const IMAGE_MODELS = [
    { value: '', label: 'Не указано' },
    { value: 'dalle', label: 'DALL·E' },
    { value: 'dalle-3', label: 'DALL·E 3' },
    { value: 'midjourney', label: 'MidJourney' },
    { value: 'stable-diffusion-xl', label: 'Stable Diffusion XL' },
    { value: 'stable-diffusion-3', label: 'Stable Diffusion 3' },
    { value: 'sdxl', label: 'SDXL' },
    { value: 'flux', label: 'Flux' },
    { value: 'kandinsky', label: 'Kandinsky' },
    { value: 'leonardo', label: 'Leonardo' },
    { value: 'ideogram', label: 'Ideogram' },
    { value: 'playground', label: 'Playground' },
    { value: 'krea', label: 'KREA' },
];

// Цветовая палитра для редактирования
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

export default function EditImagePage({ params }: PageProps) {
    const router = useRouter();
    const supabase = createClientComponentClient();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [unauthorized, setUnauthorized] = useState(false);

    // Данные картинки
    const [imageData, setImageData] = useState<any>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [prompt, setPrompt] = useState('');
    const [model, setModel] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [colors, setColors] = useState<string[]>([]);

    // Загрузка данных картинки
    useEffect(() => {
        (async () => {
            setLoading(true);

            // Проверяем авторизацию
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setUnauthorized(true);
                setLoading(false);
                return;
            }

            // Загружаем данные картинки
            const { data: image, error: fetchError } = await supabase
                .from('images_meta')
                .select('*')
                .eq('id', params.id)
                .single();

            if (fetchError || !image) {
                setNotFound(true);
                setLoading(false);
                return;
            }

            // Проверяем владельца
            if (image.user_id !== user.id) {
                setUnauthorized(true);
                setLoading(false);
                return;
            }

            // Заполняем форму
            setImageData(image);
            setTitle(image.title || '');
            setDescription(image.description || '');
            setPrompt(image.prompt || '');
            setModel(image.model || '');
            setSelectedTags(image.tags || []);
            setColors(image.colors || []);

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
            const { error: updateError } = await supabase
                .from('images_meta')
                .update({
                    title: title || null,
                    description: description || null,
                    prompt: prompt || null,
                    model: model || null,
                    tags: selectedTags.length ? selectedTags : null,
                    colors: colors.length ? colors : null,
                })
                .eq('id', params.id);

            if (updateError) {
                throw new Error(updateError.message);
            }

            setSuccess('Изменения сохранены!');

            // Перенаправляем через 1 секунду
            setTimeout(() => {
                router.back();
            }, 1000);

        } catch (err: any) {
            setError(err.message || 'Ошибка при сохранении');
        } finally {
            setSaving(false);
        }
    }

    // Добавление/удаление цвета
    function toggleColor(colorHex: string) {
        setColors(prev => {
            if (prev.includes(colorHex)) {
                return prev.filter(c => c !== colorHex);
            }
            if (prev.length >= 5) {
                return prev; // Максимум 5 цветов
            }
            return [...prev, colorHex];
        });
    }

    // Получение публичного URL картинки
    function getImageUrl(path: string) {
        const { data } = supabase.storage.from('images').getPublicUrl(path);
        return data.publicUrl;
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
                    <h1 className="mb-4 text-2xl font-bold">Картинка не найдена</h1>
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
                        Вы не можете редактировать эту картинку.
                    </p>
                    <Link href="/" className="text-blue-600 hover:underline">
                        Вернуться на главную
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl p-6">
            <div className="mb-6 flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
                >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Назад
                </button>
                <h1 className="text-2xl font-bold">Редактирование картинки</h1>
            </div>

            <div className="grid gap-16 md:grid-cols-[minmax(300px,400px)_1fr]">
                {/* Левая колонка — форма */}
                <form onSubmit={handleSubmit} className="space-y-5 pr-4">

                    {/* Описание */}
                    <div>
                        <label className="mb-1 block text-sm font-medium">Описание</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2"
                            rows={3}
                            placeholder="Краткое описание"
                        />
                    </div>

                    {/* Промт */}
                    <div>
                        <label className="mb-1 block text-sm font-medium">Промт</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2"
                            rows={4}
                            placeholder="Промт, по которому была сгенерирована картинка"
                        />
                    </div>

                    {/* Модель */}
                    <div>
                        <label className="mb-1 block text-sm font-medium">Модель</label>
                        <select
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2"
                        >
                            {IMAGE_MODELS.map((m) => (
                                <option key={m.value} value={m.value}>
                                    {m.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Теги */}
                    <div>
                        <label className="mb-1 block text-sm font-medium">Теги</label>
                        <TagSelector
                            selectedTags={selectedTags}
                            onTagsChange={setSelectedTags}
                            maxTags={10}
                            placeholder="Введите тег..."
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

                {/* Правая колонка — картинка и цвета */}
                <div className="space-y-4">
                    <div>
                        {imageData?.path ? (
                            <img
                                src={getImageUrl(imageData.path)}
                                alt={title || 'Картинка'}
                                className="w-full object-contain max-h-[400px]"
                            />
                        ) : (
                            <div className="flex h-48 items-center justify-center bg-gray-100 text-gray-400">
                                Нет изображения
                            </div>
                        )}

                        {/* Цвета под картинкой */}
                        <div className="mt-4 flex flex-col items-center">
                            <label className="mb-2 block text-sm font-medium">
                                Цвета ({colors.length}/5)
                            </label>

                            {/* Текущие выбранные цвета + кнопка добавления */}
                            <div className="mb-3 flex flex-wrap justify-center gap-2">
                                {colors.map((c, i) => (
                                    <button
                                        key={c + i}
                                        type="button"
                                        onClick={() => toggleColor(c)}
                                        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-md ring-2 ring-gray-300"
                                        style={{ backgroundColor: c }}
                                        title="Удалить цвет"
                                    >
                                        <span className="text-xs text-white drop-shadow-md">×</span>
                                    </button>
                                ))}
                                {/* Пустой кружочек для добавления цвета */}
                                {colors.length < 5 && (
                                    <div
                                        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-white text-gray-400"
                                        title="Выберите цвет из палитры ниже"
                                    >
                                        <span className="text-sm">+</span>
                                    </div>
                                )}
                            </div>

                            {/* Палитра для выбора */}
                            <div className="flex flex-wrap justify-center gap-2">
                                {COLOR_PALETTE.map((color) => {
                                    const isSelected = colors.includes(color.hex);
                                    return (
                                        <button
                                            key={color.id}
                                            type="button"
                                            onClick={() => toggleColor(color.hex)}
                                            className={`h-7 w-7 rounded-full border-2 transition ${isSelected
                                                ? 'border-gray-900 ring-2 ring-gray-400'
                                                : 'border-gray-200 hover:border-gray-400'
                                                }`}
                                            style={{ backgroundColor: color.hex }}
                                            title={color.label}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
