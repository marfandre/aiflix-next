'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import TagSelector from '../components/TagSelector';

const supabase = createClientComponentClient();

type MediaType = 'video' | 'image';

// AI-оптимизированная цветовая палитра
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

// Оттенки для AI-контента
const COLOR_SHADES: Record<string, string[]> = {
  red: ['#FFCDD2', '#FF8A80', '#FF5252', '#FF1744', '#D50000', '#B71C1C', '#7F0000'],
  orange: ['#FFE0B2', '#FFAB40', '#FF9100', '#FF6D00', '#E65100', '#BF360C', '#8D2000'],
  yellow: ['#FFF9C4', '#FFFF00', '#FFEA00', '#FFD600', '#FFC400', '#FFAB00', '#FF8F00'],
  green: ['#B9F6CA', '#69F0AE', '#00E676', '#00C853', '#00A843', '#008836', '#006B24'],
  teal: ['#A7FFEB', '#64FFDA', '#1DE9B6', '#00BFA5', '#009688', '#00796B', '#004D40'],
  cyan: ['#B2EBF2', '#80DEEA', '#4DD0E1', '#00E5FF', '#00B8D4', '#0097A7', '#006064'],
  blue: ['#BBDEFB', '#82B1FF', '#448AFF', '#2979FF', '#2962FF', '#1A46CC', '#0D2899'],
  indigo: ['#D1C4E9', '#B388FF', '#7C4DFF', '#651FFF', '#6200EA', '#4A00B0', '#2E0076'],
  purple: ['#E1BEE7', '#EA80FC', '#E040FB', '#D500F9', '#AA00FF', '#8000BF', '#560080'],
  pink: ['#F8BBD0', '#FF80AB', '#FF4081', '#F50057', '#C51162', '#960D4A', '#670833'],
  brown: ['#D7CCC8', '#BCAAA4', '#A1887F', '#8D6E63', '#6D4C41', '#4E342E', '#3E2723'],
  black: ['#FAFAFA', '#E0E0E0', '#9E9E9E', '#616161', '#424242', '#212121', '#121212'],
};

// Собираем все цвета палитры + оттенки для замены
const EXTRA_REPLACEMENT_COLORS: string[] = [
  // Базовые цвета
  ...COLOR_PALETTE.map(c => c.hex),
  // Все оттенки
  ...Object.values(COLOR_SHADES).flat(),
];

async function extractColorsFromFile(file: File): Promise<string[] | null> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/palette', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      console.error('Palette API error', await res.text());
      return null;
    }

    const data = await res.json();
    return data.colors ?? null;
  } catch (err) {
    console.error('extractColorsFromFile API error:', err);
    return null;
  }
}

type LocalImage = {
  file: File;
  previewUrl: string;
  mainColors: string[];
  basePalette: string[];
};

export default function UploadPage() {
  // AUTH
  const [sessionReady, setSessionReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const redirectUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/upload` : undefined;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
      setSessionReady(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setAuthMsg(null);
        setAuthError(null);
      }
      setHasSession(!!session);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSignUp() {
    setAuthError(null);
    setAuthMsg(null);
    if (!authEmail || !authPassword) {
      setAuthError('Введите почту и пароль.');
      return;
    }
    const { error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPassword,
      options: { emailRedirectTo: redirectUrl },
    });
    if (error) setAuthError(error.message);
    else setAuthMsg('Мы отправили письмо. Подтвердите почту и вернитесь на эту страницу.');
  }

  async function handleSignIn() {
    setAuthError(null);
    setAuthMsg(null);
    if (!authEmail || !authPassword) {
      setAuthError('Введите почту и пароль.');
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });
    if (error) setAuthError(error.message);
    else setAuthMsg('Вход выполнен.');
  }

  // UPLOAD STATE
  const [type, setType] = useState<MediaType>('video');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prompt, setPrompt] = useState(''); // промт для картинок
  const [file, setFile] = useState<File | null>(null); // используется только для видео
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Модель
  const [model, setModel] = useState<string>('');

  // Теги (жанры + атмосфера + сцена)
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // IMAGES CAROUSEL STATE (для картинок)
  const [images, setImages] = useState<LocalImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // PALETTE EDITING (для текущего слайда)
  const [isPaletteLoading, setIsPaletteLoading] = useState(false);
  const [isEditingPalette, setIsEditingPalette] = useState(false);
  const [draftColors, setDraftColors] = useState<string[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedPaletteColor, setSelectedPaletteColor] = useState<string | null>(null); // какой базовый цвет выбран для показа оттенков
  const [showShades, setShowShades] = useState(false);

  const currentImage = images[currentIndex] ?? null;

  const currentBasePalette = currentImage?.basePalette ?? [];
  const replacementPalette: string[] = Array.from(
    new Set([...currentBasePalette, ...EXTRA_REPLACEMENT_COLORS]),
  );

  const mainColors: string[] =
    (isEditingPalette ? draftColors : currentImage?.mainColors) ?? [];
  const displayMainColors = mainColors.slice(0, 5);

  async function handleAddImages(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setError(null);
    setSuccess(null);
    setIsPaletteLoading(true);

    const newLocalImages: LocalImage[] = [];

    for (const f of files) {
      const url = URL.createObjectURL(f);
      try {
        const colors = await extractColorsFromFile(f);
        const fullPalette = colors ?? [];
        const main = fullPalette.slice(0, 5);

        newLocalImages.push({
          file: f,
          previewUrl: url,
          basePalette: fullPalette,
          mainColors: main,
        });
      } catch (err) {
        console.error('Ошибка при предпросчёте палитры', err);
        newLocalImages.push({
          file: f,
          previewUrl: url,
          basePalette: [],
          mainColors: [],
        });
      }
    }

    setImages((prev) => {
      const prevLength = prev.length;
      const combined = [...prev, ...newLocalImages];
      // если до этого не было картинок — показываем первую добавленную
      if (!prevLength) {
        setCurrentIndex(0);
      } else {
        // можно перейти к первой из вновь добавленных
        setCurrentIndex(prevLength);
      }
      return combined;
    });

    setIsPaletteLoading(false);
    setIsEditingPalette(false);
    setDraftColors(null);
    setSelectedIndex(null);

    // сброс value, чтобы те же файлы можно было выбрать ещё раз
    e.target.value = '';
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (type === 'video' && !file) {
      setError('Выберите видеофайл');
      return;
    }

    if (type === 'image' && images.length === 0) {
      setError('Добавьте хотя бы одну картинку');
      return;
    }

    try {
      setIsLoading(true);

      if (type === 'video') {
        // ---------- VIDEO ----------
        const startRes = await fetch('/api/videos/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description,
            model: model || null,
            tags: selectedTags.length ? selectedTags : null,
          }),
        });
        if (!startRes.ok) throw new Error('Не удалось получить URL загрузки видео');
        const startData = await startRes.json();

        const uploadRes = await fetch(startData.url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: file as File,
        });
        if (!uploadRes.ok) throw new Error('Загрузка в Mux завершилась с ошибкой');

        setSuccess('Видео отправлено. Обработка началась.');
        setTitle('');
        setDescription('');
        setPrompt('');
        setFile(null);
        setModel('');
        setSelectedTags([]);
      } else {
        // ---------- IMAGE (карусель) ----------
        // 1) Заливаем каждый файл в storage
        const uploaded: { path: string; colors: string[] }[] = [];

        for (const img of images) {
          const startRes = await fetch('/api/images/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: img.file.name,
            }),
          });
          if (!startRes.ok) {
            throw new Error('Не удалось создать объект для картинки');
          }
          const startData = await startRes.json();

          const putRes = await fetch(startData.uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': img.file.type || 'application/octet-stream',
            },
            body: img.file,
          });
          if (!putRes.ok) {
            throw new Error('Ошибка при загрузке картинки');
          }

          const colorsToSave =
            img.mainColors && img.mainColors.length
              ? img.mainColors.slice(0, 5)
              : [];

          uploaded.push({
            path: startData.path,
            colors: colorsToSave,
          });
        }

        // 2) Отправляем метаданные + список картинок
        const completeRes = await fetch('/api/images/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images: uploaded,
            title,
            description,
            prompt,
            model: model || null,
            tags: selectedTags.length ? selectedTags : null,
          }),
        });

        if (!completeRes.ok) {
          const t = await completeRes.json().catch(() => ({}));
          throw new Error(t?.error || 'Не удалось сохранить метаданные картинок');
        }

        setSuccess('Картинки загружены.');
        setTitle('');
        setDescription('');
        setPrompt('');
        setModel('');
        setSelectedTags([]);

        // Чистим локальные превью
        images.forEach((img) => {
          URL.revokeObjectURL(img.previewUrl);
        });
        setImages([]);
        setCurrentIndex(0);
        setIsPaletteLoading(false);
        setIsEditingPalette(false);
        setDraftColors(null);
        setSelectedIndex(null);
      }
    } catch (err: any) {
      setError(err.message ?? 'Неизвестная ошибка');
    } finally {
      setIsLoading(false);
    }
  }

  if (!sessionReady) return <div className="py-10 text-gray-500">Загрузка…</div>;

  return (
    <div className="mx-auto max-w-6xl px-6">
      <h1 className="mb-4 text-3xl font-bold">Загрузка</h1>

      {hasSession && (
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => {
              setType('video');
              setFile(null);
              // чистим состояние картинок
              images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
              setImages([]);
              setCurrentIndex(0);
              setIsPaletteLoading(false);
              setIsEditingPalette(false);
              setDraftColors(null);
              setSelectedIndex(null);
              setError(null);
              setSuccess(null);
            }}
            className={`rounded px-4 py-2 ${type === 'video' ? 'bg-black text-white' : 'border'
              }`}
          >
            Видео
          </button>
          <button
            onClick={() => {
              setType('image');
              setFile(null);
              setError(null);
              setSuccess(null);
            }}
            className={`rounded px-4 py-2 ${type === 'image' ? 'bg-black text-white' : 'border'
              }`}
          >
            Картинка
          </button>
        </div>
      )}

      {!hasSession && (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Войдите или зарегистрируйтесь</h2>

          {authMsg && (
            <div className="mb-3 rounded border border-green-200 bg-green-50 p-2 text-sm text-green-700">
              {authMsg}
            </div>
          )}
          {authError && (
            <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {authError}
            </div>
          )}

          <label className="mb-1 block text-sm font-medium">Почта</label>
          <input
            type="email"
            className="mb-3 w-full rounded border px-3 py-2"
            placeholder="you@example.com"
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
          />

          <label className="mb-1 block text-sm font-medium">Пароль</label>
          <input
            type="password"
            className="mb-4 w-full rounded border px-3 py-2"
            placeholder="минимум 6 символов"
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
          />

          <div className="flex gap-2">
            <button onClick={handleSignUp} className="flex-1 rounded bg-black py-2 text-white">
              Зарегистрироваться
            </button>
            <button onClick={handleSignIn} className="flex-1 rounded border py-2">
              Войти
            </button>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Или вернитесь к просмотру: <a className="underline" href="/">на главную</a>
          </p>
        </div>
      )}

      {hasSession && (
        <>
          {/* скрытый инпут для изображений (карусель) */}
          {type === 'image' && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleAddImages}
            />
          )}

          <div className="mt-2 grid items-start gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
            {/* Левая колонка — форма */}
            <form onSubmit={onSubmit} className="space-y-4 pt-6">
              <div>
                <label className="mb-1 block text-sm">Название</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded border px-3 py-2"
                  placeholder="можно оставить пустым"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm">Описание</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded border px-3 py-2"
                  rows={4}
                  placeholder="короткое описание (можно пустым)"
                />
              </div>

              {/* Промт — только для картинок */}
              {type === 'image' && (
                <div>
                  <label className="mb-1 block text-sm">Промт (prompt для генерации)</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full rounded border px-3 py-2"
                    rows={4}
                    placeholder="промт, по которому была сгенерирована картинка (можно пустым)"
                  />
                </div>
              )}

              {/* Теги (жанры, атмосфера, сцена) */}
              <div>
                <label className="mb-1 block text-sm">Теги (жанры, атмосфера, сцена)</label>
                <TagSelector
                  selectedTags={selectedTags}
                  onTagsChange={setSelectedTags}
                  maxTags={10}
                  placeholder="Введите тег..."
                />
              </div>

              {/* Модель */}
              <div>
                <label className="mb-1 block text-sm">Модель</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded border px-3 py-2 text-sm"
                >
                  <option value="">Не указано</option>
                  {type === 'video' ? (
                    <>
                      <option value="sora">Sora</option>
                      <option value="pika">Pika</option>
                      <option value="runway">Runway</option>
                      <option value="kling">Kling</option>
                      <option value="gen-3">Gen-3</option>
                      <option value="midjourney">Midjourney</option>
                    </>
                  ) : (
                    <>
                      <option value="dalle">DALL·E</option>
                      <option value="dalle-3">DALL·E 3</option>
                      <option value="midjourney">Midjourney</option>
                      <option value="stable-diffusion-xl">Stable Diffusion XL</option>
                      <option value="stable-diffusion-3">Stable Diffusion 3</option>
                      <option value="sdxl">SDXL</option>
                      <option value="flux">Flux</option>
                      <option value="kandinsky">Kandinsky</option>
                      <option value="leonardo">Leonardo</option>
                      <option value="ideogram">Ideogram</option>
                      <option value="playground">Playground</option>
                      <option value="krea">KREA</option>
                    </>
                  )}
                </select>
              </div>

              {/* Файл */}
              <div>
                <label className="mb-1 block text-sm">
                  {type === 'video' ? 'Файл (MP4/WEBM)' : 'Файлы (PNG/JPG)'}
                </label>

                {type === 'video' ? (
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    onChange={(e) => {
                      const newFile = e.target.files?.[0] ?? null;
                      setFile(newFile);
                      setError(null);
                      setSuccess(null);
                    }}
                  />
                ) : (
                  <p className="text-xs text-gray-500">
                    Для картинок используйте плюс в предпросмотре справа, чтобы добавить
                    одно или несколько изображений к посту.
                  </p>
                )}
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-green-600">{success}</p>}

              <button
                type="submit"
                className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? 'Загрузка…' : 'Загрузить'}
              </button>
            </form>

            {/* Правая колонка — предпросмотр картинок и палитра */}
            {type === 'image' && (
              <div className="relative rounded-xl border bg-white p-4 md:-mt-16">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-700">
                    Предпросмотр картинок
                  </h2>
                </div>

                {/* Область превью + стрелки + плюс */}
                <div className="relative mb-3 flex items-center justify-center">
                  {images.length > 0 ? (
                    <>
                      {/* стрелка влево */}
                      {images.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentIndex((i) =>
                              (i - 1 + images.length) % images.length
                            )
                          }
                          className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-2 py-1 text-xs text-white"
                        >
                          ◀
                        </button>
                      )}

                      <img
                        src={currentImage?.previewUrl}
                        alt="Предпросмотр"
                        className="max-h-80 w-full max-w-full rounded object-contain"
                      />

                      {/* стрелка вправо */}
                      {images.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentIndex((i) => (i + 1) % images.length)
                          }
                          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-2 py-1 text-xs text-white"
                        >
                          ▶
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="h-48 w-full rounded bg-gray-50 text-center text-sm text-gray-500 flex items-center justify-center">
                      Добавьте PNG/JPG через плюс, чтобы увидеть предпросмотр и палитру.
                    </p>
                  )}

                  {/* плюсик для добавления новых файлов */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg shadow hover:bg-white"
                    title="Добавить изображения"
                  >
                    +
                  </button>
                </div>

                {isPaletteLoading && (
                  <p className="text-xs text-gray-500">Считаем палитру…</p>
                )}

                {displayMainColors.length > 0 && (
                  <div className="relative mt-2">
                    <div className="flex flex-wrap items-center justify-center gap-3 pr-12">
                      {displayMainColors.map((c, index) => {
                        const isSelected =
                          isEditingPalette && selectedIndex === index;

                        return (
                          <button
                            key={c + index}
                            type="button"
                            onClick={() => {
                              if (!isEditingPalette) return;
                              setSelectedIndex(index);
                            }}
                            className={`flex items-center justify-center rounded-full border transition ${isSelected
                              ? 'border-black ring-2 ring-black/60'
                              : 'border-gray-200'
                              }`}
                            style={{
                              padding: isSelected ? 3 : 1,
                            }}
                            title={isEditingPalette ? 'Выбрать этот цвет' : c}
                          >
                            <span
                              className="block rounded-full"
                              style={{
                                backgroundColor: c,
                                width: 32,
                                height: 32,
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>

                    {/* Кнопка редактирования палитры */}
                    {!isEditingPalette && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!currentImage || !currentImage.mainColors.length) return;
                          setIsEditingPalette(true);
                          setDraftColors([...currentImage.mainColors.slice(0, 5)]);
                          setSelectedIndex(0);
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-500 shadow border border-gray-200 transition hover:bg-gray-50 hover:text-gray-700"
                        title="Редактировать палитру"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}

                {isEditingPalette && (
                  <div className="mt-5 border-t pt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-600">
                        Палитра для замены
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!draftColors || selectedIndex == null) return;
                            const next = [...draftColors];
                            next.splice(selectedIndex, 1);
                            setDraftColors(next.length ? next : []);
                            if (!next.length) {
                              setSelectedIndex(null);
                            } else {
                              setSelectedIndex(
                                Math.min(selectedIndex, next.length - 1),
                              );
                            }
                          }}
                          className="rounded-full border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                          title="Удалить выбранный цвет"
                        >
                          Удалить
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (draftColors && currentImage) {
                              const updated = draftColors.slice(0, 5);
                              setImages((prev) =>
                                prev.map((img, idx) =>
                                  idx === currentIndex
                                    ? { ...img, mainColors: updated }
                                    : img,
                                ),
                              );
                            }
                            setIsEditingPalette(false);
                            setDraftColors(null);
                            setSelectedIndex(null);
                          }}
                          className="flex items-center gap-1 rounded-full border px-2 py-1 text-xs"
                          title="Применить изменения"
                        >
                          ✓ <span className="hidden sm:inline">Применить</span>
                        </button>
                      </div>
                    </div>

                    {/* Цвета из картинки + Пипетка */}
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-[10px] text-gray-500">Из картинки:</span>
                      <div className="flex gap-1">
                        {currentBasePalette.map((c, index) => (
                          <button
                            key={c + index}
                            type="button"
                            onClick={() => {
                              if (selectedIndex == null) return;
                              setDraftColors((prev) => {
                                if (!prev) return prev;
                                const next = [...prev];
                                next[selectedIndex] = c;
                                return next;
                              });
                            }}
                            title={c}
                            className="rounded-full border border-gray-200 hover:border-gray-400 hover:scale-110 transition-transform"
                          >
                            <span
                              className="block rounded-full"
                              style={{ backgroundColor: c, width: 22, height: 22 }}
                            />
                          </button>
                        ))}
                      </div>

                      {/* Пипетка — иконка */}
                      {'EyeDropper' in window && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (selectedIndex == null) return;
                            try {
                              // @ts-ignore - EyeDropper API
                              const eyeDropper = new window.EyeDropper();
                              const result = await eyeDropper.open();
                              if (result?.sRGBHex) {
                                setDraftColors((prev) => {
                                  if (!prev) return prev;
                                  const next = [...prev];
                                  next[selectedIndex] = result.sRGBHex.toUpperCase();
                                  return next;
                                });
                              }
                            } catch (e) {
                              // User cancelled
                            }
                          }}
                          disabled={selectedIndex == null}
                          className="ml-1 w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Пипетка — захватить цвет с экрана"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gray-600">
                            <path d="m2 22 1-1h3l9-9" />
                            <path d="M3 21v-3l9-9" />
                            <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* AI Палитра — круглые кнопки */}
                    <div className="flex gap-1.5 flex-wrap">
                      {COLOR_PALETTE.map((color) => {
                        const isSelected = selectedPaletteColor === color.id;
                        return (
                          <button
                            key={color.id}
                            type="button"
                            className={`rounded-full transition-all ${isSelected ? 'ring-2 ring-gray-900 ring-offset-1 scale-110' : 'hover:scale-110'}`}
                            onClick={() => {
                              // Toggle: при повторном клике скрыть оттенки
                              if (isSelected) {
                                setSelectedPaletteColor(null);
                              } else {
                                setSelectedPaletteColor(color.id);
                              }
                              // Также применить цвет
                              if (selectedIndex != null) {
                                setDraftColors((prev) => {
                                  if (!prev) return prev;
                                  const next = [...prev];
                                  next[selectedIndex] = color.hex;
                                  return next;
                                });
                              }
                            }}
                            title={color.label}
                          >
                            <span
                              className="block rounded-full border border-gray-200"
                              style={{ backgroundColor: color.hex, width: 26, height: 26 }}
                            />
                          </button>
                        );
                      })}
                    </div>

                    {/* Кнопка Оттенки / Скрыть оттенки */}
                    {selectedPaletteColor && COLOR_SHADES[selectedPaletteColor] && (
                      <button
                        type="button"
                        onClick={() => setShowShades(!showShades)}
                        className="mt-2 rounded-full border border-gray-300 px-3 py-1 text-[11px] text-gray-600 hover:bg-gray-100"
                      >
                        {showShades ? 'Скрыть оттенки' : 'Оттенки'}
                      </button>
                    )}

                    {/* Оттенки — появляются по кнопке */}
                    {selectedPaletteColor && showShades && COLOR_SHADES[selectedPaletteColor] && (
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {COLOR_SHADES[selectedPaletteColor].map((shadeHex, idx) => (
                          <button
                            key={shadeHex}
                            type="button"
                            className="rounded-full hover:scale-110 transition-transform"
                            onClick={() => {
                              if (selectedIndex == null) return;
                              setDraftColors((prev) => {
                                if (!prev) return prev;
                                const next = [...prev];
                                next[selectedIndex] = shadeHex;
                                return next;
                              });
                            }}
                            title={`Оттенок ${idx + 1}`}
                          >
                            <span
                              className="block rounded-full border border-gray-100"
                              style={{ backgroundColor: shadeHex, width: 22, height: 22 }}
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
