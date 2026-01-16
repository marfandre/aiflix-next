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

type ExtractedPalette = {
  colors: string[];
  accentColors: string[];
};

async function extractColorsFromFile(file: File): Promise<ExtractedPalette | null> {
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
    return {
      colors: data.colors ?? [],
      accentColors: data.accentColors ?? [],
    };
  } catch (err) {
    console.error('extractColorsFromFile API error:', err);
    return null;
  }
}

// Извлечение кадра из видео и получение цветов
async function extractColorsFromVideo(videoFile: File): Promise<{ previewUrl: string | null; colors: string[] }> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(videoFile);
    video.src = objectUrl;

    video.onloadeddata = async () => {
      // Перематываем на 1 секунду или на середину если короче
      const seekTime = Math.min(1, video.duration / 2);
      video.currentTime = seekTime;
    };

    video.onseeked = async () => {
      try {
        // Создаём canvas и рисуем кадр
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve({ previewUrl: null, colors: [] });
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Получаем превью как data URL
        const previewUrl = canvas.toDataURL('image/jpeg', 0.8);

        // Конвертируем в blob для отправки на API
        canvas.toBlob(async (blob) => {
          URL.revokeObjectURL(objectUrl);

          if (!blob) {
            resolve({ previewUrl, colors: [] });
            return;
          }

          // Отправляем на API палитры
          const formData = new FormData();
          formData.append('file', blob, 'frame.jpg');

          try {
            const res = await fetch('/api/palette', {
              method: 'POST',
              body: formData,
            });

            if (res.ok) {
              const data = await res.json();
              resolve({ previewUrl, colors: data.colors ?? [] });
            } else {
              resolve({ previewUrl, colors: [] });
            }
          } catch {
            resolve({ previewUrl, colors: [] });
          }
        }, 'image/jpeg', 0.8);
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve({ previewUrl: null, colors: [] });
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ previewUrl: null, colors: [] });
    };

    // Начинаем загрузку
    video.load();
  });
}

type LocalImage = {
  file: File;
  previewUrl: string;
  mainColors: string[];
  accentColors: string[];  // Акцентные цвета
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
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null); // превью кадра видео
  const [videoColors, setVideoColors] = useState<string[]>([]); // цвета видео
  const [isVideoColorsLoading, setIsVideoColorsLoading] = useState(false); // загрузка цветов видео
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
  const [selectedAccentIndex, setSelectedAccentIndex] = useState<number | null>(null); // для редактирования акцентов
  const [showAccentSlots, setShowAccentSlots] = useState(false); // показывать ли слоты для акцентов
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
  const displayAccentColors = currentImage?.accentColors ?? [];

  // Общая функция обработки файлов (для input и paste)
  async function processFiles(files: File[]) {
    if (!files.length) return;

    setError(null);
    setSuccess(null);
    setIsPaletteLoading(true);

    const newLocalImages: LocalImage[] = [];

    for (const f of files) {
      // Фильтруем только изображения
      if (!f.type.startsWith('image/')) continue;

      const url = URL.createObjectURL(f);
      try {
        const paletteResult = await extractColorsFromFile(f);
        const fullPalette = paletteResult?.colors ?? [];
        const main = fullPalette.slice(0, 5);
        // Акценты не определяем автоматически — пользователь добавит сам через кнопку Accent

        newLocalImages.push({
          file: f,
          previewUrl: url,
          basePalette: fullPalette,
          mainColors: main,
          accentColors: [], // Пустой — пользователь добавит сам
        });
      } catch (err) {
        console.error('Ошибка при предпросчёте палитры', err);
        newLocalImages.push({
          file: f,
          previewUrl: url,
          basePalette: [],
          mainColors: [],
          accentColors: [],
        });
      }
    }

    if (newLocalImages.length === 0) {
      setIsPaletteLoading(false);
      return;
    }

    setImages((prev) => {
      const prevLength = prev.length;
      const combined = [...prev, ...newLocalImages];
      if (!prevLength) {
        setCurrentIndex(0);
      } else {
        setCurrentIndex(prevLength);
      }
      return combined;
    });

    setIsPaletteLoading(false);
    setIsEditingPalette(false);
    setDraftColors(null);
    setSelectedIndex(null);
  }

  // Обработчик paste события (Ctrl+V)
  useEffect(() => {
    if (type !== 'image') return;

    async function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        await processFiles(files);
      }
    }

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [type, currentIndex]);

  async function handleAddImages(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(e.target.files ?? []);
    await processFiles(files);
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
            prompt: prompt || null,
            model: model || null,
            tags: selectedTags.length ? selectedTags : null,
            colors: videoColors.length ? videoColors.slice(0, 5) : null,
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
        setVideoPreviewUrl(null);
        setVideoColors([]);
        setModel('');
        setSelectedTags([]);
      } else {
        // ---------- IMAGE (карусель) ----------
        // 1) Заливаем каждый файл в storage
        const uploaded: { path: string; colors: string[]; accentColors: string[] }[] = [];

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

          const accentColorsToSave =
            img.accentColors && img.accentColors.length
              ? img.accentColors.slice(0, 3)
              : [];

          uploaded.push({
            path: startData.path,
            colors: colorsToSave,
            accentColors: accentColorsToSave,
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

          <form onSubmit={onSubmit}>
            <div className="mt-2 flex flex-col md:flex-row gap-10 items-start justify-between">
              {/* Левая колонка — поля формы (вторичная) */}
              <div className="space-y-4" style={{ width: 380, flexShrink: 0 }}>
                {/* Переключатель Видео / Картинка */}
                <div className="flex items-center gap-2 pb-2">
                  <button
                    type="button"
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
                    className={`rounded px-4 py-2 text-sm font-medium transition-colors ${type === 'video' ? 'bg-black text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    Видео
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setType('image');
                      setFile(null);
                      setError(null);
                      setSuccess(null);
                    }}
                    className={`rounded px-4 py-2 text-sm font-medium transition-colors ${type === 'image' ? 'bg-black text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    Картинка
                  </button>
                </div>

                {/* Промт */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-600">Промт</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-gray-300 focus:bg-white focus:outline-none transition"
                    rows={4}
                    placeholder={type === 'video' ? 'Опишите видео...' : 'Опишите изображение...'}
                  />
                </div>

                {/* Теги */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-600">Теги</label>
                  <TagSelector
                    selectedTags={selectedTags}
                    onTagsChange={setSelectedTags}
                    maxTags={10}
                    placeholder="Добавить тег..."
                  />
                </div>

                {/* Модель */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-600">Модель</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className={`w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-gray-300 focus:bg-white focus:outline-none transition ${!model ? 'text-gray-400' : 'text-gray-900'}`}
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

                {/* Сообщения об ошибках/успехе */}
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                    {success}
                  </div>
                )}
              </div>

              {/* Правая колонка — главная карточка превью */}
              <div className="flex flex-col items-center" style={{ width: 340, flexShrink: 0 }}>
                {/* Большая карточка превью */}
                <div
                  className="relative w-full rounded-3xl border-2 border-dashed border-gray-200 bg-white shadow-sm overflow-hidden cursor-pointer hover:border-gray-300 hover:shadow-md transition-all"
                  style={{ aspectRatio: type === 'video' ? '9/16' : '4/5' }}
                  onClick={() => {
                    if (type === 'video') {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'video/mp4,video/webm';
                      input.onchange = async (e: any) => {
                        const newFile = e.target.files?.[0] ?? null;
                        setFile(newFile);
                        setError(null);
                        setSuccess(null);
                        setVideoPreviewUrl(null);
                        setVideoColors([]);
                        if (newFile) {
                          setIsVideoColorsLoading(true);
                          try {
                            const { previewUrl, colors } = await extractColorsFromVideo(newFile);
                            setVideoPreviewUrl(previewUrl);
                            setVideoColors(colors);
                          } catch (err) {
                            console.error('Error extracting video colors:', err);
                          } finally {
                            setIsVideoColorsLoading(false);
                          }
                        }
                      };
                      input.click();
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  {/* Контент внутри карточки */}
                  {type === 'video' ? (
                    videoPreviewUrl ? (
                      <img
                        src={videoPreviewUrl}
                        alt="Превью видео"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                        {isVideoColorsLoading ? (
                          <p className="text-sm">Загрузка...</p>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-16 h-16 mb-3 text-gray-300">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                            </svg>
                            <p className="text-sm font-medium">Нажмите, чтобы выбрать видео</p>
                            <p className="text-xs text-gray-300 mt-1">MP4 или WEBM</p>
                          </>
                        )}
                      </div>
                    )
                  ) : (
                    images.length > 0 && currentImage ? (
                      <>
                        <img
                          src={currentImage.previewUrl}
                          alt="Превью"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        {/* Навигация по карусели */}
                        {images.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setCurrentIndex((i) => (i - 1 + images.length) % images.length); }}
                              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-white hover:bg-black/80"
                            >◀</button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setCurrentIndex((i) => (i + 1) % images.length); }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-white hover:bg-black/80"
                            >▶</button>
                          </>
                        )}
                        {/* Индикатор количества */}
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                          {currentIndex + 1} / {images.length}
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                        {isPaletteLoading ? (
                          <p className="text-sm">Загрузка...</p>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-16 h-16 mb-3 text-gray-300">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                            </svg>
                            <p className="text-sm font-medium">Нажмите или Ctrl+V</p>
                            <p className="text-xs text-gray-300 mt-1">PNG, JPG</p>
                          </>
                        )}
                      </div>
                    )
                  )}
                </div>

                {/* Палитра цветов под карточкой */}
                {((type === 'video' && videoColors.length > 0) || (type === 'image' && currentImage?.mainColors?.length)) && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    {(type === 'video' ? videoColors : currentImage?.mainColors ?? []).slice(0, 5).map((c, idx) => (
                      <div
                        key={c + idx}
                        className="w-8 h-8 rounded-full border border-gray-200 shadow-sm"
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                )}

                {/* Кнопка загрузки */}
                <button
                  type="submit"
                  className="mt-6 w-full rounded-2xl bg-black px-6 py-3 text-white font-medium transition hover:bg-gray-800 disabled:opacity-50"
                  disabled={isLoading}
                >
                  {isLoading ? 'Загрузка…' : 'Загрузить'}
                </button>
              </div>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

