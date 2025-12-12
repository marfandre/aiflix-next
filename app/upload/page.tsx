'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();

type MediaType = 'video' | 'image';

// дополнительные цвета для палитры
const EXTRA_REPLACEMENT_COLORS: string[] = [
  '#ffffff',
  '#f5f5f5',
  '#000000',
  '#808080',
  '#1f2933',

  '#ff0000',
  '#ff7f00',
  '#ffbf00',
  '#ffff00',
  '#9acd32',

  '#00ff00',
  '#00ffff',
  '#008b8b',
  '#0000ff',
  '#4169e1',

  '#800080',
  '#ff00ff',
  '#8b4513',
  '#d2691e',
  '#ffc0cb',
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

  // Жанры / настроение / тип изображения
  const [genresInput, setGenresInput] = useState<string>(''); // "sci-fi, cyberpunk"
  const [mood, setMood] = useState<string>('');               // "cozy dark"
  const [imageType, setImageType] = useState<string>('');     // только для картинок

  // IMAGES CAROUSEL STATE (для картинок)
  const [images, setImages] = useState<LocalImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // PALETTE EDITING (для текущего слайда)
  const [isPaletteLoading, setIsPaletteLoading] = useState(false);
  const [isEditingPalette, setIsEditingPalette] = useState(false);
  const [draftColors, setDraftColors] = useState<string[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Преобразуем строку жанров в массив строк для API
  const parsedGenres = genresInput
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);

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
            genres: parsedGenres.length ? parsedGenres : null,
            mood: mood || null,
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
        setGenresInput('');
        setMood('');
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
            genres: parsedGenres.length ? parsedGenres : null,
            mood: mood || null,
            imageType: imageType || null,
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
        setGenresInput('');
        setMood('');
        setImageType('');

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
            className={`rounded px-4 py-2 ${
              type === 'video' ? 'bg-black text-white' : 'border'
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
            className={`rounded px-4 py-2 ${
              type === 'image' ? 'bg-black text-white' : 'border'
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

              {/* Жанры */}
              <div>
                <label className="mb-1 block text-sm">Жанры</label>
                <input
                  value={genresInput}
                  onChange={(e) => setGenresInput(e.target.value)}
                  className="w-full rounded border px-3 py-2 text-sm"
                  placeholder="например: sci-fi, cyberpunk, drama"
                />
              </div>

              {/* Атмосфера / настроение */}
              <div>
                <label className="mb-1 block text-sm">Атмосфера / настроение</label>
                <input
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  className="w-full rounded border px-3 py-2 text-sm"
                  placeholder="например: cozy, dark futuristic, epic"
                />
              </div>

              {/* Тип изображения — только для картинок */}
              {type === 'image' && (
                <div>
                  <label className="mb-1 block text-sm">Тип изображения</label>
                  <select
                    value={imageType}
                    onChange={(e) => setImageType(e.target.value)}
                    className="w-full rounded border px-3 py-2 text-sm"
                  >
                    <option value="">Не указано</option>
                    <option value="portrait">Портрет</option>
                    <option value="landscape">Пейзаж</option>
                    <option value="interior">Интерьер</option>
                    <option value="cityscape">Город</option>
                    <option value="abstract">Абстракция</option>
                    <option value="macro">Макро</option>
                  </select>
                </div>
              )}

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

                  {displayMainColors.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!currentImage || !currentImage.mainColors.length) return;
                        setIsEditingPalette(true);
                        setDraftColors([...currentImage.mainColors.slice(0, 5)]);
                        setSelectedIndex(0);
                      }}
                      className="rounded-full border px-2 py-1 text-xs"
                      title="Редактировать палитру для текущего изображения"
                    >
                      ✏️
                    </button>
                  )}
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
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                    {displayMainColors.map((c, index) => {
                      const base = 32;
                      const step = 4;
                      const size = Math.max(16, base - index * step);
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
                          className={`flex items-center justify-center rounded-full border transition ${
                            isSelected
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
                              width: size,
                              height: size,
                            }}
                          />
                        </button>
                      );
                    })}
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

                    <div className="grid grid-cols-8 gap-2 max-[480px]:grid-cols-6">
                      {replacementPalette.map((c, index) => (
                        <button
                          key={c + index}
                          type="button"
                          className="rounded-md border border-gray-200 p-[2px]"
                          onClick={() => {
                            if (!isEditingPalette) return;
                            if (selectedIndex == null) return;
                            setDraftColors((prev) => {
                              if (!prev) return prev;
                              const next = [...prev];
                              next[selectedIndex] = c;
                              return next;
                            });
                          }}
                          title="Заменить выбранный цвет этим"
                        >
                          <span
                            className="block rounded-[4px]"
                            style={{
                              backgroundColor: c,
                              width: 22,
                              height: 22,
                            }}
                          />
                        </button>
                      ))}
                    </div>
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
