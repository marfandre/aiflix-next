'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import TagSelector from '../components/TagSelector';
import ColorPickerOverlay, { ColorMarker } from '../components/ColorPickerOverlay';
import { getColorAtPosition } from '../utils/getColorAtPosition';
import { getAspectRatioString } from '../utils/aspectRatio';

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
  colorWeights: number[];  // Веса цветов (процент площади)
  colorNames: string[];    // NTC названия цветов
  accentColors: string[];
  colorPositions: ColorMarker[];  // Координаты цветов на изображении
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
      colorWeights: data.colorWeights ?? [],
      colorNames: data.colorNames ?? [],
      accentColors: data.accentColors ?? [],
      colorPositions: data.colorPositions ?? [],
    };
  } catch (err) {
    console.error('extractColorsFromFile API error:', err);
    return null;
  }
}

async function extractTagsFromFile(file: File): Promise<string[]> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/tags/generate', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      console.error('Tags API error', await res.text());
      return [];
    }

    const data = await res.json();
    return data.tags ?? [];
  } catch (err) {
    console.error('extractTagsFromFile API error:', err);
    return [];
  }
}

// Hex → RGB
function hexToRgbArr(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

// Расстояние между двумя цветами (Euclidean в RGB)
function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgbArr(a);
  const [r2, g2, b2] = hexToRgbArr(b);
  return Math.sqrt((r2 - r1) ** 2 + (g2 - g1) ** 2 + (b2 - b1) ** 2);
}

// Выбрать N самых разнообразных цветов из массива (max-distance greedy)
function selectDiverseColors(allColors: string[], count: number): string[] {
  if (allColors.length <= count) return allColors;

  // Начинаем с первого цвета
  const selected = [allColors[0]];
  const remaining = allColors.slice(1);

  while (selected.length < count && remaining.length > 0) {
    // Находим цвет, максимально далёкий от всех уже выбранных
    let bestIdx = 0;
    let bestMinDist = -1;

    for (let i = 0; i < remaining.length; i++) {
      const minDist = Math.min(...selected.map(s => colorDistance(s, remaining[i])));
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  return selected;
}

// Извлечение цветов из одного кадра видео через canvas → /api/palette
function extractFrameColors(video: HTMLVideoElement, time: number): Promise<{ blob: Blob | null; colors: string[] }> {
  return new Promise((resolve) => {
    video.currentTime = time;

    video.onseeked = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve({ blob: null, colors: [] });
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(async (blob) => {
          if (!blob) {
            resolve({ blob: null, colors: [] });
            return;
          }

          try {
            const formData = new FormData();
            formData.append('file', blob, 'frame.jpg');
            const res = await fetch('/api/palette', { method: 'POST', body: formData });

            if (res.ok) {
              const data = await res.json();
              resolve({ blob, colors: data.colors ?? [] });
            } else {
              resolve({ blob, colors: [] });
            }
          } catch {
            resolve({ blob, colors: [] });
          }
        }, 'image/jpeg', 0.8);
      } catch {
        resolve({ blob: null, colors: [] });
      }
    };
  });
}

// Данные о кадре видео (время + цвета)
interface VideoFrame {
  time: number;       // секунда кадра
  percent: number;    // процент длительности (25, 50, 75)
  colors: string[];
}

// Извлечение кадров из видео: 3 кадра (25%, 50%, 75%) → merge в 5 цветов + данные покадрово
// Возвращает videoObjectUrl (не revoke!) для воспроизведения
async function extractColorsFromVideo(videoFile: File): Promise<{
  previewUrl: string | null;
  videoObjectUrl: string;
  colors: string[];
  videoBlob: Blob | null;
  frames: VideoFrame[];
  duration: number;
}> {
  return new Promise(async (resolve) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(videoFile);
    video.src = objectUrl;

    video.onloadeddata = async () => {
      try {
        const duration = video.duration;
        // 3 точки: 25%, 50%, 75% длительности
        const samplePercents = [25, 50, 75];
        const sampleTimes = [
          Math.max(0.5, duration * 0.25),
          Math.max(1, duration * 0.5),
          Math.max(1.5, duration * 0.75),
        ];

        // Превью — с середины видео (для тегирования и фоллбека)
        const midTime = sampleTimes[1];
        video.currentTime = midTime;
        await new Promise<void>((res) => { video.onseeked = () => res(); });

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const previewUrl = canvas.toDataURL('image/jpeg', 0.8);

        // Извлекаем цвета из 3 кадров последовательно
        const allColors: string[] = [];
        let previewBlob: Blob | null = null;
        const frames: VideoFrame[] = [];

        for (let i = 0; i < sampleTimes.length; i++) {
          const time = sampleTimes[i];
          const result = await extractFrameColors(video, time);
          allColors.push(...result.colors);

          if (i === 1) {
            previewBlob = result.blob;
          }

          frames.push({
            time,
            percent: samplePercents[i],
            colors: result.colors.slice(0, 5),
          });
        }

        // НЕ revoke objectUrl — он нужен для <video> плеера

        if (allColors.length === 0) {
          resolve({ previewUrl, videoObjectUrl: objectUrl, colors: [], videoBlob: previewBlob, frames, duration });
          return;
        }

        const finalColors = selectDiverseColors(allColors, 5);
        resolve({ previewUrl, videoObjectUrl: objectUrl, colors: finalColors, videoBlob: previewBlob, frames, duration });
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve({ previewUrl: null, videoObjectUrl: '', colors: [], videoBlob: null, frames: [], duration: 0 });
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ previewUrl: null, videoObjectUrl: '', colors: [], videoBlob: null, frames: [], duration: 0 });
    };

    video.load();
  });
}

type LocalImage = {
  file: File;
  previewUrl: string;
  mainColors: string[];
  colorWeights: number[];  // Веса цветов
  colorNames: string[];    // NTC названия
  accentColors: string[];  // Акцентные цвета
  basePalette: string[];
  colorPositions: ColorMarker[];  // Координаты маркеров
  aspectRatio: string | null;     // Соотношение сторон (px:px)
  tags: string[];                 // Авто-теги от ИИ
  isTagging?: boolean;            // В процессе ли генерация тегов
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
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null); // превью кадра видео (data URL)
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null); // object URL для воспроизведения
  const [videoDuration, setVideoDuration] = useState(0); // длительность видео в секундах
  const [videoColors, setVideoColors] = useState<string[]>([]); // цвета видео
  const [isVideoColorsLoading, setIsVideoColorsLoading] = useState(false); // загрузка цветов видео
  const [isEditingVideoColors, setIsEditingVideoColors] = useState(false); // редактирование цветов видео
  const [selectedVideoColorIdx, setSelectedVideoColorIdx] = useState<number | null>(null); // выбранный цвет для замены
  const [videoFrames, setVideoFrames] = useState<VideoFrame[]>([]); // кадры с покадровыми цветами
  const [isVideoPlaying, setIsVideoPlaying] = useState(false); // воспроизводится ли видео
  const [videoProgress, setVideoProgress] = useState(0); // прогресс 0-1
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoRafRef = useRef<number>(0); // requestAnimationFrame ID
  const [videoTags, setVideoTags] = useState<string[]>([]); // авто-теги видео
  const [isVideoTagging, setIsVideoTagging] = useState(false); // состояние загрузки тегов
  const [videoDraftColors, setVideoDraftColors] = useState<string[] | null>(null); // черновые цвета видео
  const [videoAccentColors, setVideoAccentColors] = useState<string[]>([]); // акцентные цвета видео
  const [selectedVideoAccentIdx, setSelectedVideoAccentIdx] = useState<number | null>(null); // выбранный акцент
  const [showVideoAccentSlots, setShowVideoAccentSlots] = useState(false); // показывать акцентные слоты
  const [selectedVideoPaletteColor, setSelectedVideoPaletteColor] = useState<string | null>(null); // выбранный базовый для оттенков
  const [showVideoShades, setShowVideoShades] = useState(false); // показывать оттенки

  // requestAnimationFrame loop для плавного прогресса таймлайна
  useEffect(() => {
    if (!isVideoPlaying) {
      cancelAnimationFrame(videoRafRef.current);
      return;
    }

    const tick = () => {
      const v = videoRef.current;
      if (v && v.duration) {
        setVideoProgress(v.currentTime / v.duration);
      }
      videoRafRef.current = requestAnimationFrame(tick);
    };
    videoRafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(videoRafRef.current);
  }, [isVideoPlaying]);
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
    isEditingPalette && draftColors
      ? draftColors
      : (type === 'video'
        ? (isEditingVideoColors && videoDraftColors ? videoDraftColors : videoColors)
        : (currentImage?.mainColors ?? []));
  const displayMainColors = mainColors.slice(0, 5);
  const displayAccentColors = currentImage?.accentColors ?? [];

  // Все цвета из кадров видео (для панели "Из видео")
  const videoBasePalette: string[] = Array.from(
    new Set(videoFrames.flatMap(f => f.colors))
  );

  // Общая функция обработки файлов (для input и paste)
  async function processFiles(files: File[]) {
    if (!files.length) return;

    setError(null);
    setSuccess(null);
    setIsPaletteLoading(true);

    const newLocalImages: LocalImage[] = [];

    const imageFiles = files.filter(f => f.type.startsWith('image/'));

    const parsedImages = await Promise.all(
      imageFiles.map(async (f) => {
        const url = URL.createObjectURL(f);
        try {
          let aspectRatio: string | null = null;
          try {
            const imgObj = new Image();
            imgObj.src = url;
            await new Promise((resolve) => {
              imgObj.onload = () => {
                aspectRatio = getAspectRatioString(imgObj.width, imgObj.height);
                resolve(null);
              };
              imgObj.onerror = () => resolve(null);
            });
          } catch (e) { }

          const paletteResult = await extractColorsFromFile(f);
          const fullPalette = paletteResult?.colors ?? [];
          const main = fullPalette.slice(0, 5);
          const weights = paletteResult?.colorWeights?.slice(0, 5) ?? [];
          const names = paletteResult?.colorNames?.slice(0, 5) ?? [];
          const positions = paletteResult?.colorPositions?.slice(0, 5) ?? [];

          const imgObj: LocalImage = {
            file: f,
            previewUrl: url,
            basePalette: fullPalette,
            mainColors: main,
            colorWeights: weights,
            colorNames: names,
            accentColors: [],
            colorPositions: positions,
            aspectRatio,
            tags: [],
            isTagging: true,
          };

          // Fetch tags asynchronously
          extractTagsFromFile(f).then(tags => {
            setImages(current => current.map(img =>
              img.previewUrl === url
                ? { ...img, tags, isTagging: false }
                : img
            ));
          });

          return imgObj;
        } catch (err) {
          console.error('Ошибка при предпросчёте палитры', err);
          return {
            file: f,
            previewUrl: url,
            basePalette: [],
            mainColors: [],
            colorWeights: [],
            colorNames: [],
            accentColors: [],
            colorPositions: [],
            aspectRatio: null,
            tags: [],
            isTagging: false,
          } as LocalImage;
        }
      })
    );

    newLocalImages.push(...parsedImages);

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

        const startData = await startRes.json();
        if (!startRes.ok) {
          throw new Error(startData.error || 'Не удалось получить URL загрузки видео');
        }

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
        if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
        setVideoPreviewUrl(null);
        setVideoObjectUrl(null);
        setVideoColors([]);
        setVideoFrames([]);
        setVideoDuration(0);
        setIsVideoPlaying(false);
        setVideoProgress(0);
        setIsEditingVideoColors(false);
        setSelectedVideoColorIdx(null);
        setVideoDraftColors(null);
        setVideoAccentColors([]);
        setSelectedVideoAccentIdx(null);
        setShowVideoAccentSlots(false);
        setSelectedVideoPaletteColor(null);
        setShowVideoShades(false);
        setModel('');
        setSelectedTags([]);
      } else {
        // ---------- IMAGE (карусель) ----------
        // 1) Заливаем каждый файл в storage
        const uploaded: { path: string; colors: string[]; colorWeights: number[]; colorNames: string[]; accentColors: string[]; colorPositions: ColorMarker[]; aspectRatio: string | null }[] = [];

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

          const colorWeightsToSave =
            img.colorWeights && img.colorWeights.length
              ? img.colorWeights.slice(0, 5)
              : [];

          const colorNamesToSave =
            img.colorNames && img.colorNames.length
              ? img.colorNames.slice(0, 5)
              : [];

          const accentColorsToSave =
            img.accentColors && img.accentColors.length
              ? img.accentColors.slice(0, 3)
              : [];

          const colorPositionsToSave =
            img.colorPositions && img.colorPositions.length
              ? img.colorPositions.slice(0, 5)
              : [];

          uploaded.push({
            path: startData.path,
            colors: colorsToSave,
            colorWeights: colorWeightsToSave,
            colorNames: colorNamesToSave,
            accentColors: accentColorsToSave,
            colorPositions: colorPositionsToSave,
            aspectRatio: img.aspectRatio || null,
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

  if (!sessionReady) {
    return <div className="py-10 text-gray-500">Загрузка…</div>;
  }

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
            <div className="mt-2 flex flex-col md:flex-row gap-10 items-start">
              {/* Левая колонка — поля формы (вторичная) */}
              <div className="space-y-4" style={{ width: 380, flexShrink: 0 }}>
                {/* Переключатель Видео / Картинка */}
                <div className="flex items-center gap-2 pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setType('video');
                      setFile(null);
                      // Сбрасываем палитру/редактирование, но НЕ удаляем картинки
                      setIsPaletteLoading(false);
                      setIsEditingPalette(false);
                      setDraftColors(null);
                      setSelectedIndex(null);
                      setSelectedTags([]);
                      setError(null);
                      setSuccess(null);
                    }}
                    className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${type === 'video' ? 'text-white shadow-sm' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    style={type === 'video' ? { backgroundColor: '#1E3A5F' } : undefined}
                  >
                    Видео
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setType('image');
                      setFile(null);
                      setSelectedTags([]);
                      setError(null);
                      setSuccess(null);
                    }}
                    className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${type === 'image' ? 'text-white shadow-sm' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    style={type === 'image' ? { backgroundColor: '#1E3A5F' } : undefined}
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

                  {/* Блок Авто-Тегов (только для картинок) */}
                  {type === 'image' && currentImage && (
                    <div className="mt-2 min-h-[24px]">
                      {currentImage.isTagging ? (
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>ИИ подбирает теги...</span>
                        </div>
                      ) : currentImage.tags && currentImage.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <span className="text-[11px] font-medium text-blue-500 uppercase tracking-wider mr-1">AI-Теги:</span>
                          {currentImage.tags.map(t => {
                            // Проверяем, добавлен ли тег (как строка или как tag_id:en)
                            const isAdded = selectedTags.some(st =>
                              st === t || st === `${t}:en` || st.startsWith(`${t}:`)
                            );
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => {
                                  if (isAdded) {
                                    // Удаляем тег в любом формате
                                    setSelectedTags(selectedTags.filter(st =>
                                      st !== t && st !== `${t}:en` && !st.startsWith(`${t}:`)
                                    ));
                                  } else if (selectedTags.length < 10) {
                                    // Добавляем в формате tag:en для единообразия с TagSelector
                                    setSelectedTags([...selectedTags, `${t}:en`]);
                                  }
                                }}
                                className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${isAdded
                                  ? 'bg-blue-50 border-blue-200 text-blue-600'
                                  : 'bg-white border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-500'
                                  }`}
                              >
                                {isAdded ? `✓ ${t}` : `+ ${t}`}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Модель */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-600">Модель</label>
                  <input
                    list={`models-${type}`}
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Выбрать или ввести..."
                    className={`w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-gray-300 focus:bg-white focus:outline-none transition ${!model ? 'text-gray-400' : 'text-gray-900'}`}
                  />
                  <datalist id="models-video">
                    <option value="sora">Sora</option>
                    <option value="veo">Veo</option>
                    <option value="veo-2">Veo 2</option>
                    <option value="veo-3">Veo 3</option>
                    <option value="veo-3.1">Veo 3.1</option>
                    <option value="pika">Pika</option>
                    <option value="runway">Runway</option>
                    <option value="kling">Kling</option>
                    <option value="gen-3">Gen-3</option>
                    <option value="midjourney">Midjourney</option>
                  </datalist>
                  <datalist id="models-image">
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
                  </datalist>
                </div>

                {/* Кнопка загрузки */}
                <button
                  type="submit"
                  className="mt-4 w-full rounded-2xl bg-black px-6 py-3 text-white font-medium transition hover:bg-gray-800 disabled:opacity-50"
                  disabled={isLoading}
                >
                  {isLoading ? 'Загрузка…' : 'Загрузить'}
                </button>

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
              {type === 'video' && (
                <div className="flex-1 flex flex-col items-center">
                  <div
                    className={`relative w-full max-w-[340px] rounded-3xl border-2 border-dashed bg-white shadow-sm overflow-hidden transition-all ${videoObjectUrl ? 'border-transparent border-dashed-none' : 'border-gray-200 cursor-pointer hover:border-gray-300 hover:shadow-md'}`}
                    style={videoObjectUrl ? {} : { aspectRatio: '9/16' }}
                    onClick={() => {
                      if (!videoObjectUrl) {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'video/mp4,video/webm';
                        input.onchange = async (e: any) => {
                          const newFile = e.target.files?.[0] ?? null;
                          setFile(newFile);
                          setError(null);
                          setSuccess(null);
                          // Revoke old object URL
                          if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
                          setVideoPreviewUrl(null);
                          setVideoObjectUrl(null);
                          setVideoColors([]);
                          setVideoFrames([]);
                          setVideoTags([]);
                          setIsEditingVideoColors(false);
                          setSelectedVideoColorIdx(null);
                          setIsVideoPlaying(false);
                          setVideoProgress(0);
                          setVideoDuration(0);
                          if (newFile) {
                            setIsVideoColorsLoading(true);
                            setIsVideoTagging(true);
                            try {
                              const { previewUrl, videoObjectUrl: objUrl, colors, videoBlob, frames, duration } = await extractColorsFromVideo(newFile);
                              setVideoPreviewUrl(previewUrl);
                              setVideoObjectUrl(objUrl);
                              setVideoColors(colors);
                              setVideoFrames(frames);
                              setVideoDuration(duration);

                              if (videoBlob) {
                                const fakeFile = new File([videoBlob], 'preview.jpg', { type: 'image/jpeg' });
                                extractTagsFromFile(fakeFile).then(tags => {
                                  setVideoTags(tags);
                                  setIsVideoTagging(false);
                                });
                              } else {
                                setIsVideoTagging(false);
                              }
                            } catch (err) {
                              console.error('Error extracting video colors:', err);
                              setIsVideoTagging(false);
                            } finally {
                              setIsVideoColorsLoading(false);
                            }
                          }
                        };
                        input.click();
                      }
                    }}
                  >
                    {/* Контент внутри карточки */}
                    {
                      videoObjectUrl ? (
                        <>
                          <video
                            ref={videoRef}
                            src={videoObjectUrl}
                            className="w-full rounded-3xl"
                            style={{ display: 'block' }}
                            muted
                            playsInline
                            loop
                            onPlay={() => setIsVideoPlaying(true)}
                            onPause={() => setIsVideoPlaying(false)}
                            onClick={(e) => {
                              e.stopPropagation();
                              const v = videoRef.current;
                              if (!v) return;
                              if (v.paused) v.play();
                              else v.pause();
                            }}
                          />
                          {/* Play/Pause overlay removed — button moved to timeline */}
                          {/* Пипетка — оверлей поверх видео */}
                          {isEditingVideoColors && selectedVideoColorIdx !== null && (
                            <div
                              className="absolute inset-0 z-10 rounded-3xl"
                              style={{ cursor: 'crosshair' }}
                              onClick={async (e) => {
                                e.stopPropagation();
                                // Pause video for color picking
                                videoRef.current?.pause();
                                const rect = e.currentTarget.getBoundingClientRect();
                                const x = (e.clientX - rect.left) / rect.width;
                                const y = (e.clientY - rect.top) / rect.height;
                                try {
                                  const hex = await getColorAtPosition(videoPreviewUrl!, x, y);
                                  const newColors = [...videoColors];
                                  newColors[selectedVideoColorIdx] = hex;
                                  setVideoColors(newColors);
                                  setSelectedVideoColorIdx(null);
                                } catch (err) {
                                  console.error('Eyedropper error:', err);
                                }
                              }}
                            >
                              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-white text-xs font-medium backdrop-blur-sm">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M2 22l1-1h3l9-9" />
                                  <path d="M3 21v-3l9-9" />
                                  <path d="M14.5 5.5l4-4 4 4-4 4" />
                                </svg>
                                Кликните на цвет
                              </div>
                            </div>
                          )}
                        </>
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
                      )}
                  </div>

                  {/* Таймлайн с цветовыми метками */}
                  {videoObjectUrl && videoFrames.length > 0 && (
                    <div className="mt-3 w-full max-w-[340px]">
                      <div className="flex items-center gap-2">
                        {/* Play/Pause кнопка */}
                        <button
                          type="button"
                          onClick={() => {
                            const v = videoRef.current;
                            if (!v) return;
                            if (v.paused) v.play();
                            else v.pause();
                          }}
                          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition"
                        >
                          {isVideoPlaying ? (
                            <svg className="w-3.5 h-3.5 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5 text-gray-700 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          )}
                        </button>
                      <div
                        className="relative h-8 flex-1 flex items-center cursor-pointer group"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                          const v = videoRef.current;
                          if (v && v.duration) {
                            v.currentTime = x * v.duration;
                            setVideoProgress(x);
                          }
                        }}
                      >
                        {/* Линия таймлайна (фон) */}
                        <div className="absolute left-0 right-0 h-1 rounded-full bg-gray-200" />
                        {/* Прогресс */}
                        <div
                          className="absolute left-0 h-1 rounded-full bg-gray-400"
                          style={{ width: `${videoProgress * 100}%` }}
                        />
                        {/* Ползунок прогресса */}
                        <div
                          className="absolute w-3 h-3 rounded-full bg-white border-2 border-gray-400 shadow-sm -translate-x-1/2 opacity-0 group-hover:opacity-100"
                          style={{ left: `${videoProgress * 100}%` }}
                        />
                        {/* Цветовые метки на таймлайне */}
                        {videoFrames.map((frame, idx) => {
                          const pos = frame.percent / 100;
                          // Берём доминантный цвет кадра
                          const mainColor = frame.colors[0] || '#888';
                          const isSelected = videoColors.includes(mainColor);
                          return (
                            <div
                              key={idx}
                              className="absolute -translate-x-1/2 flex flex-col items-center group/marker"
                              style={{ left: `${pos * 100}%` }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const v = videoRef.current;
                                if (v) {
                                  v.currentTime = frame.time;
                                  v.pause();
                                  setVideoProgress(pos);
                                }
                              }}
                            >
                              {/* Метка-кружок */}
                              <div
                                className="w-4 h-4 rounded-full border-2 border-white shadow-md hover:scale-125 transition-transform cursor-pointer"
                                style={{ backgroundColor: mainColor }}
                                title={`${frame.percent}% — ${frame.colors.join(', ')}`}
                              />
                              {/* Тултип с цветами при наведении */}
                              <div className="absolute top-6 hidden group-hover/marker:flex items-center gap-0.5 bg-white rounded-full px-1.5 py-1 shadow-lg border border-gray-100 z-10">
                                {frame.colors.slice(0, 5).map((c, ci) => {
                                  const picked = videoColors.includes(c);
                                  return (
                                    <span
                                      key={ci}
                                      className={`block rounded-full ${picked ? 'bg-gray-200 p-[3px]' : ''}`}
                                      style={picked
                                        ? { width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }
                                        : { backgroundColor: c, width: 10, height: 10 }
                                      }
                                    >
                                      {picked && (
                                        <span className="block rounded-full w-full h-full" style={{ backgroundColor: c }} />
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      </div>
                      {/* Время */}
                      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5 pl-10">
                        <span>{videoDuration > 0 ? `${Math.floor(videoProgress * videoDuration)}с` : '0с'}</span>
                        <span>{videoDuration > 0 ? `${Math.floor(videoDuration)}с` : ''}</span>
                      </div>
                    </div>
                  )}

                  {/* Палитра цветов видео */}
                  {videoColors.length > 0 && (
                    <div className="relative mt-4 flex items-center justify-center">
                      <div className="flex items-center justify-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm border border-gray-100">
                        {(isEditingVideoColors && videoDraftColors ? videoDraftColors : videoColors).slice(0, 5).map((c, index) => {
                          const isSelected = isEditingVideoColors && selectedVideoColorIdx === index;
                          return (
                            <button
                              key={c + index}
                              type="button"
                              onClick={() => {
                                if (!isEditingVideoColors) return;
                                setSelectedVideoColorIdx(index);
                                setSelectedVideoAccentIdx(null);
                              }}
                              className={`flex items-center justify-center rounded-full transition-all ${isSelected
                                ? 'ring-2 ring-black ring-offset-2 scale-110'
                                : 'border border-gray-200 hover:scale-105'
                                }`}
                              style={{ width: 32, height: 32 }}
                              title={isEditingVideoColors ? 'Нажмите для замены' : c}
                            >
                              <span
                                className="block rounded-full"
                                style={{
                                  backgroundColor: c,
                                  width: isSelected ? 32 : 30,
                                  height: isSelected ? 32 : 30,
                                }}
                              />
                            </button>
                          );
                        })}

                        {/* Акцентные цвета видео */}
                        {showVideoAccentSlots && (
                          <>
                            <span className="mx-1 h-4 w-px bg-gray-200" />
                            {[0, 1, 2].map((slotIdx) => {
                              const accentColor = videoAccentColors[slotIdx];
                              const isAccentSelected = isEditingVideoColors && selectedVideoAccentIdx === slotIdx;
                              return (
                                <button
                                  key={`vaccent-${slotIdx}`}
                                  type="button"
                                  onClick={() => {
                                    if (!isEditingVideoColors) return;
                                    if (isAccentSelected && accentColor) {
                                      setVideoAccentColors(prev => prev.filter((_, i) => i !== slotIdx));
                                      setSelectedVideoAccentIdx(null);
                                    } else {
                                      setSelectedVideoAccentIdx(slotIdx);
                                      setSelectedVideoColorIdx(null);
                                    }
                                  }}
                                  className={`flex items-center justify-center rounded-full transition-all ${isAccentSelected
                                    ? 'ring-2 ring-blue-500 ring-offset-1 scale-110'
                                    : accentColor
                                      ? 'border border-gray-200 hover:scale-105'
                                      : 'border-2 border-dashed border-gray-300 hover:border-gray-400'
                                    }`}
                                  style={{ width: 22, height: 22 }}
                                  title={accentColor || 'Добавить акцент'}
                                >
                                  {accentColor ? (
                                    <span className="block rounded-full" style={{ backgroundColor: accentColor, width: isAccentSelected ? 22 : 18, height: isAccentSelected ? 22 : 18 }} />
                                  ) : (
                                    <span className="text-gray-400 text-xs">+</span>
                                  )}
                                </button>
                              );
                            })}
                          </>
                        )}
                      </div>

                      {/* Кнопка редактирования (карандаш) */}
                      {!isEditingVideoColors && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingVideoColors(true);
                            setVideoDraftColors([...videoColors.slice(0, 5)]);
                            setSelectedVideoColorIdx(0);
                            setSelectedVideoAccentIdx(null);
                          }}
                          className="absolute -right-12 top-1/2 -translate-y-1/2 rounded-full bg-white p-2 text-gray-500 shadow border border-gray-200 hover:bg-gray-50 hover:text-gray-700 transition"
                          title="Редактировать цвета"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path d="m2.695 14.762-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.886L17.5 5.501a2.121 2.121 0 0 0-3-3L3.58 13.419a4 4 0 0 0-.885 1.343Z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Панель редактирования цветов видео (3-я колонка) */}
              {type === 'video' && isEditingVideoColors && (
                <div className="flex-1 min-w-[300px] animate-in slide-in-from-right-4 fade-in duration-300">
                  <div className="sticky top-6 w-full rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-center justify-between border-b pb-3">
                      <span className="text-sm font-semibold text-gray-700">
                        Палитра для замены
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedVideoColorIdx != null && videoDraftColors) {
                              const next = [...videoDraftColors];
                              next.splice(selectedVideoColorIdx, 1);
                              setVideoDraftColors(next.length ? next : []);
                              if (!next.length) setSelectedVideoColorIdx(null);
                              else setSelectedVideoColorIdx(Math.min(selectedVideoColorIdx, next.length - 1));
                            } else if (selectedVideoAccentIdx != null) {
                              setVideoAccentColors(prev => prev.filter((_, i) => i !== selectedVideoAccentIdx));
                              setSelectedVideoAccentIdx(null);
                            }
                          }}
                          className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
                          title="Удалить выбранный цвет"
                        >
                          Удалить
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (videoDraftColors) {
                              setVideoColors(videoDraftColors.slice(0, 5));
                            }
                            setIsEditingVideoColors(false);
                            setVideoDraftColors(null);
                            setSelectedVideoColorIdx(null);
                            setSelectedVideoAccentIdx(null);
                            if (!videoAccentColors.length) setShowVideoAccentSlots(false);
                          }}
                          className="flex items-center gap-1 rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 transition"
                        >
                          ✓ Применить
                        </button>
                      </div>
                    </div>

                    {/* Цвета из видео + Пипетка + Accent */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">Из видео:</span>
                        <div className="flex items-center gap-3">
                          {'EyeDropper' in window && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (selectedVideoColorIdx == null && selectedVideoAccentIdx == null) return;
                                try {
                                  // @ts-ignore
                                  const eyeDropper = new window.EyeDropper();
                                  const result = await eyeDropper.open();
                                  if (result?.sRGBHex) {
                                    const hex = result.sRGBHex.toUpperCase();
                                    if (selectedVideoColorIdx != null) {
                                      setVideoDraftColors(prev => {
                                        if (!prev) return prev;
                                        const next = [...prev];
                                        next[selectedVideoColorIdx] = hex;
                                        return next;
                                      });
                                    } else if (selectedVideoAccentIdx != null) {
                                      setVideoAccentColors(prev => {
                                        const next = [...prev];
                                        next[selectedVideoAccentIdx] = hex;
                                        return next.slice(0, 3);
                                      });
                                    }
                                  }
                                } catch (e) { }
                              }}
                              disabled={selectedVideoColorIdx == null && selectedVideoAccentIdx == null}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                                <path d="m2 22 1-1h3l9-9" />
                                <path d="M3 21v-3l9-9" />
                                <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
                              </svg>
                              Пипетка
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowVideoAccentSlots(!showVideoAccentSlots)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition ${showVideoAccentSlots
                              ? 'bg-purple-50 border-purple-300 text-purple-700'
                              : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                              }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
                            </svg>
                            Accent
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {videoBasePalette.map((c, index) => (
                          <button
                            key={c + index}
                            type="button"
                            onClick={() => {
                              if (selectedVideoColorIdx != null) {
                                setVideoDraftColors(prev => {
                                  if (!prev) return prev;
                                  const next = [...prev];
                                  next[selectedVideoColorIdx] = c;
                                  return next;
                                });
                              } else if (selectedVideoAccentIdx != null) {
                                setVideoAccentColors(prev => {
                                  const next = [...prev];
                                  next[selectedVideoAccentIdx] = c;
                                  return next.slice(0, 3);
                                });
                              }
                            }}
                            title={c}
                            className="h-6 w-6 rounded-full border border-gray-200 hover:border-gray-400 hover:scale-110 transition shadow-sm"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Базовые цвета */}
                    <div className="border-t pt-3">
                      <span className="mb-2 block text-xs text-gray-500">Базовые цвета:</span>
                      <div className="flex flex-wrap gap-2">
                        {COLOR_PALETTE.map((color) => {
                          const isColorSelected = selectedVideoPaletteColor === color.id;
                          return (
                            <button
                              key={color.id}
                              type="button"
                              className={`h-7 w-7 rounded-full transition-all border border-gray-200 flex items-center justify-center ${isColorSelected ? 'ring-2 ring-gray-900 ring-offset-1 scale-110' : 'hover:scale-110'}`}
                              style={{ backgroundColor: color.hex }}
                              onClick={() => {
                                if (isColorSelected) {
                                  setSelectedVideoPaletteColor(null);
                                } else {
                                  setSelectedVideoPaletteColor(color.id);
                                }
                                if (selectedVideoColorIdx != null) {
                                  setVideoDraftColors(prev => {
                                    if (!prev) return prev;
                                    const next = [...prev];
                                    next[selectedVideoColorIdx] = color.hex;
                                    return next;
                                  });
                                } else if (selectedVideoAccentIdx != null) {
                                  setVideoAccentColors(prev => {
                                    const next = [...prev];
                                    next[selectedVideoAccentIdx] = color.hex;
                                    return next.slice(0, 3);
                                  });
                                }
                              }}
                              title={color.label}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Оттенки */}
                    {selectedVideoPaletteColor && showVideoShades && COLOR_SHADES[selectedVideoPaletteColor] && (
                      <div className="mt-3 animate-in fade-in slide-in-from-top-1">
                        <span className="mb-2 block text-xs text-gray-500">Оттенки {COLOR_PALETTE.find(c => c.id === selectedVideoPaletteColor)?.label}:</span>
                        <div className="flex flex-wrap gap-2">
                          {COLOR_SHADES[selectedVideoPaletteColor].map((shadeHex) => (
                            <button
                              key={shadeHex}
                              type="button"
                              className="h-6 w-6 rounded-full border border-gray-100 hover:scale-110 transition-transform shadow-sm"
                              style={{ backgroundColor: shadeHex }}
                              onClick={() => {
                                if (selectedVideoColorIdx != null) {
                                  setVideoDraftColors(prev => {
                                    if (!prev) return prev;
                                    const next = [...prev];
                                    next[selectedVideoColorIdx] = shadeHex;
                                    return next;
                                  });
                                } else if (selectedVideoAccentIdx != null) {
                                  setVideoAccentColors(prev => {
                                    const next = [...prev];
                                    next[selectedVideoAccentIdx] = shadeHex;
                                    return next.slice(0, 3);
                                  });
                                }
                              }}
                              title={shadeHex}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Кнопка показа оттенков */}
                    {selectedVideoPaletteColor && !showVideoShades && COLOR_SHADES[selectedVideoPaletteColor] && (
                      <button
                        type="button"
                        onClick={() => setShowVideoShades(true)}
                        className="mt-2 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                        </svg>
                        Показать оттенки
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* IMAGE MODE */}
              {type === 'image' && (
                <>

                  <div className="flex flex-col items-center" style={{ width: 340, flexShrink: 0 }}>
                    <div className="mb-3 flex w-full items-center justify-between">
                      <h2 className="text-sm font-semibold text-gray-700">
                        Предпросмотр картинок
                      </h2>
                    </div>

                    {/* Область превью + стрелки + плюс */}
                    <div className="relative mb-3 flex items-center justify-center">
                      {images.length > 0 ? (
                        <div className="relative">
                          {images.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setCurrentIndex((i) =>
                                  (i - 1 + images.length) % images.length,
                                )
                              }
                              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                            >
                              ◀
                            </button>
                          )}

                          <div
                            className="relative w-full rounded-3xl border-2 border-dashed border-gray-200 bg-white shadow-sm overflow-hidden"
                            style={{
                              width: 340,
                            }}
                          >
                            <ColorPickerOverlay
                              imageUrl={currentImage?.previewUrl ?? ''}
                              colors={currentImage?.colorPositions ?? []}
                              onColorsChange={(newColors) => {
                                if (!currentImage) return;
                                setImages((prev) => {
                                  const updated = [...prev];
                                  updated[currentIndex] = {
                                    ...currentImage,
                                    colorPositions: newColors,
                                    mainColors: newColors.map(c => c.hex),
                                  };
                                  return updated;
                                });
                              }}
                              maxColors={5}
                              className="h-full w-full"
                            />
                          </div>

                          {images.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setCurrentIndex((i) => (i + 1) % images.length)
                              }
                              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                            >
                              ▶
                            </button>
                          )}
                        </div>
                      ) : (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="relative flex w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400 hover:border-gray-400 hover:bg-gray-100"
                          style={{
                            width: 340,
                            aspectRatio: '340/420',
                          }}
                        >
                          <div className="mb-2 rounded-full bg-white p-4 shadow-sm">
                            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                          </div>
                          <p className="text-center text-sm font-medium">
                            Загрузить картинку
                          </p>
                          <p className="text-center text-xs text-gray-400 mt-1">
                            PNG, JPG up to 10MB
                          </p>
                        </div>
                      )}
                    </div>

                    {isPaletteLoading && (
                      <p className="text-xs text-gray-500">Считаем палитру…</p>
                    )}

                    {/* Палитра цветов */}
                    {displayMainColors.length > 0 && (
                      <div className="relative mt-4 flex items-center justify-center">
                        <div className="flex items-center justify-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm border border-gray-100">
                          {displayMainColors.map((c, index) => {
                            const isSelected = isEditingPalette && selectedIndex === index;
                            return (
                              <button
                                key={c + index}
                                type="button"
                                onClick={() => {
                                  if (!isEditingPalette) return;
                                  setSelectedIndex(index);
                                  setSelectedAccentIndex(null);
                                }}
                                className={`flex items-center justify-center rounded-full transition-all ${isSelected
                                  ? 'ring-2 ring-black ring-offset-2 scale-110'
                                  : 'border border-gray-200 hover:scale-105'
                                  }`}
                                style={{ width: 32, height: 32 }}
                                title={isEditingPalette ? 'Выбрать этот цвет для замены' : c}
                              >
                                <span
                                  className="block rounded-full"
                                  style={{
                                    backgroundColor: c,
                                    width: isSelected ? 32 : 30,
                                    height: isSelected ? 32 : 30,
                                  }}
                                />
                              </button>
                            );
                          })}

                          {/* Акцентные цвета (3 маленьких кружка) */}
                          {showAccentSlots && (
                            <>
                              <span className="mx-1 h-4 w-px bg-gray-200" />
                              {[0, 1, 2].map((slotIdx) => {
                                const accentColor = displayAccentColors[slotIdx];
                                const isAccentSelected = isEditingPalette && selectedAccentIndex === slotIdx;
                                return (
                                  <button
                                    key={`accent-${slotIdx}`}
                                    type="button"
                                    onClick={() => {
                                      if (!isEditingPalette) return;

                                      // Если слот уже выбран и есть цвет — удаляем
                                      if (isAccentSelected && accentColor) {
                                        setImages((prev) =>
                                          prev.map((img, idx) => {
                                            if (idx !== currentIndex) return img;
                                            const newAccents = img.accentColors.filter((_, i) => i !== slotIdx);
                                            return { ...img, accentColors: newAccents };
                                          })
                                        );
                                        setSelectedAccentIndex(null);
                                      } else {
                                        setSelectedAccentIndex(slotIdx);
                                        setSelectedIndex(null);
                                      }
                                    }}
                                    className={`flex items-center justify-center rounded-full transition-all ${isAccentSelected
                                      ? 'ring-2 ring-blue-500 ring-offset-1 scale-110'
                                      : accentColor
                                        ? 'border border-gray-200 hover:scale-105'
                                        : 'border-2 border-dashed border-gray-300 hover:border-gray-400'
                                      }`}
                                    style={{ width: 22, height: 22 }}
                                    title={
                                      !isEditingPalette
                                        ? accentColor || 'Акцент'
                                        : accentColor
                                          ? 'Выбрать для замены'
                                          : 'Добавить акцентный цвет'
                                    }
                                  >
                                    {accentColor ? (
                                      <span
                                        className="block rounded-full"
                                        style={{
                                          backgroundColor: accentColor,
                                          width: isAccentSelected ? 22 : 18,
                                          height: isAccentSelected ? 22 : 18,
                                        }}
                                      />
                                    ) : (
                                      <span className="text-gray-400 text-xs">+</span>
                                    )}
                                  </button>
                                );
                              })}
                            </>
                          )}
                        </div>

                        {/* Кнопка редактирования (карандаш) */}
                        {!isEditingPalette && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              if (!currentImage || !currentImage.mainColors) return;
                              setIsEditingPalette(true);
                              setDraftColors([...currentImage.mainColors.slice(0, 5)]);
                              setSelectedIndex(0);
                            }}
                            className="absolute -right-12 top-1/2 -translate-y-1/2 rounded-full bg-white p-2 text-gray-500 shadow border border-gray-200 hover:bg-gray-50 hover:text-gray-700 transition"
                            title="Редактировать цвета"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                              <path d="m2.695 14.762-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.886L17.5 5.501a2.121 2.121 0 0 0-3-3L3.58 13.419a4 4 0 0 0-.885 1.343Z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* UI Редактирования (3-я колонка) */}
                  {isEditingPalette && (
                    <div className="flex-1 min-w-[300px] animate-in slide-in-from-right-4 fade-in duration-300">
                      <div className="sticky top-6 w-full rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="mb-4 flex items-center justify-between border-b pb-3">
                          <span className="text-sm font-semibold text-gray-700">
                            Палитра для замены
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                // Удаление основного цвета
                                if (selectedIndex != null && draftColors) {
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
                                }
                                // Удаление акцентного цвета
                                else if (selectedAccentIndex != null) {
                                  setImages((prev) =>
                                    prev.map((img, idx) => {
                                      if (idx !== currentIndex) return img;
                                      const newAccents = img.accentColors.filter((_, i) => i !== selectedAccentIndex);
                                      return { ...img, accentColors: newAccents };
                                    })
                                  );
                                  setSelectedAccentIndex(null);
                                }
                              }}
                              className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
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
                                setSelectedAccentIndex(null);
                                // Скрываем акцентные слоты если нет добавленных акцентов
                                if (!displayAccentColors.length) {
                                  setShowAccentSlots(false);
                                }
                              }}
                              className="flex items-center gap-1 rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 transition"
                              title="Применить изменения"
                            >
                              ✓ Применить
                            </button>
                          </div>
                        </div>


                        {/* Цвета из картинки + Пипетка + Accent */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-500">Из картинки:</span>
                            <div className="flex items-center gap-3">
                              {'EyeDropper' in window && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    // Работаем с основным или акцентным цветом в зависимости от выбора
                                    if (selectedIndex == null && selectedAccentIndex == null) return;
                                    try {
                                      // @ts-ignore
                                      const eyeDropper = new window.EyeDropper();
                                      const result = await eyeDropper.open();
                                      if (result?.sRGBHex) {
                                        const hex = result.sRGBHex.toUpperCase();
                                        if (selectedIndex != null) {
                                          setDraftColors((prev) => {
                                            if (!prev) return prev;
                                            const next = [...prev];
                                            next[selectedIndex] = hex;
                                            return next;
                                          });
                                        } else if (selectedAccentIndex != null) {
                                          // Добавляем/заменяем акцентный цвет
                                          setImages((prev) =>
                                            prev.map((img, idx) => {
                                              if (idx !== currentIndex) return img;
                                              const newAccents = [...img.accentColors];
                                              newAccents[selectedAccentIndex] = hex;
                                              return { ...img, accentColors: newAccents.slice(0, 3) };
                                            })
                                          );
                                        }
                                      }
                                    } catch (e) { }
                                  }}
                                  disabled={selectedIndex == null && selectedAccentIndex == null}
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                                    <path d="m2 22 1-1h3l9-9" />
                                    <path d="M3 21v-3l9-9" />
                                    <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
                                  </svg>
                                  Пипетка
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setShowAccentSlots(!showAccentSlots)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition ${showAccentSlots
                                  ? 'bg-purple-50 border-purple-300 text-purple-700'
                                  : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                                  }`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
                                </svg>
                                Accent
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {currentBasePalette.map((c, index) => (
                              <button
                                key={c + index}
                                type="button"
                                onClick={() => {
                                  if (selectedIndex != null) {
                                    setDraftColors((prev) => {
                                      if (!prev) return prev;
                                      const next = [...prev];
                                      next[selectedIndex] = c;
                                      return next;
                                    });
                                  } else if (selectedAccentIndex != null) {
                                    // Добавляем цвет в акцентный слот
                                    setImages((prev) =>
                                      prev.map((img, idx) => {
                                        if (idx !== currentIndex) return img;
                                        const newAccents = [...img.accentColors];
                                        newAccents[selectedAccentIndex] = c;
                                        return { ...img, accentColors: newAccents.slice(0, 3) };
                                      })
                                    );
                                  }
                                }}
                                title={c}
                                className="h-6 w-6 rounded-full border border-gray-200 hover:border-gray-400 hover:scale-110 transition shadow-sm"
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </div>

                        {/* AI Палитра */}
                        <div className="border-t pt-3">
                          <span className="mb-2 block text-xs text-gray-500">Базовые цвета:</span>
                          <div className="flex flex-wrap gap-2">
                            {COLOR_PALETTE.map((color) => {
                              const isSelected = selectedPaletteColor === color.id;
                              return (
                                <button
                                  key={color.id}
                                  type="button"
                                  className={`h-7 w-7 rounded-full transition-all border border-gray-200 flex items-center justify-center ${isSelected ? 'ring-2 ring-gray-900 ring-offset-1 scale-110' : 'hover:scale-110'}`}
                                  style={{ backgroundColor: color.hex }}
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedPaletteColor(null);
                                    } else {
                                      setSelectedPaletteColor(color.id);
                                    }
                                    if (selectedIndex != null) {
                                      setDraftColors((prev) => {
                                        if (!prev) return prev;
                                        const next = [...prev];
                                        next[selectedIndex] = color.hex;
                                        return next;
                                      });
                                    } else if (selectedAccentIndex != null) {
                                      // Добавляем цвет в акцентный слот
                                      setImages((prev) =>
                                        prev.map((img, idx) => {
                                          if (idx !== currentIndex) return img;
                                          const newAccents = [...img.accentColors];
                                          newAccents[selectedAccentIndex] = color.hex;
                                          return { ...img, accentColors: newAccents.slice(0, 3) };
                                        })
                                      );
                                    }
                                  }}
                                  title={color.label}
                                />
                              );
                            })}
                          </div>
                        </div>

                        {/* Оттенки */}
                        {selectedPaletteColor && showShades && COLOR_SHADES[selectedPaletteColor] && (
                          <div className="mt-3 animate-in fade-in slide-in-from-top-1">
                            <span className="mb-2 block text-xs text-gray-500">Оттенки {COLOR_PALETTE.find(c => c.id === selectedPaletteColor)?.label}:</span>
                            <div className="flex flex-wrap gap-2">
                              {COLOR_SHADES[selectedPaletteColor].map((shadeHex, idx) => (
                                <button
                                  key={shadeHex}
                                  type="button"
                                  className="h-6 w-6 rounded-full border border-gray-100 hover:scale-110 transition-transform shadow-sm"
                                  style={{ backgroundColor: shadeHex }}
                                  onClick={() => {
                                    if (selectedIndex != null) {
                                      setDraftColors((prev) => {
                                        if (!prev) return prev;
                                        const next = [...prev];
                                        next[selectedIndex] = shadeHex;
                                        return next;
                                      });
                                    } else if (selectedAccentIndex != null) {
                                      // Добавляем оттенок в акцентный слот
                                      setImages((prev) =>
                                        prev.map((img, idx) => {
                                          if (idx !== currentIndex) return img;
                                          const newAccents = [...img.accentColors];
                                          newAccents[selectedAccentIndex] = shadeHex;
                                          return { ...img, accentColors: newAccents.slice(0, 3) };
                                        })
                                      );
                                    }
                                  }}
                                  title={shadeHex}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Кнопка Оттенки (если выбрана база, но не открыты оттенки) */}
                        {selectedPaletteColor && !showShades && COLOR_SHADES[selectedPaletteColor] && (
                          <button
                            type="button"
                            onClick={() => setShowShades(true)}
                            className="mt-3 w-full rounded border border-gray-200 bg-gray-50 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
                          >
                            Показать оттенки
                          </button>
                        )}
                        {selectedPaletteColor && showShades && (
                          <button
                            type="button"
                            onClick={() => setShowShades(false)}
                            className="mt-3 w-full rounded border border-gray-200 bg-gray-50 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
                          >
                            Скрыть оттенки
                          </button>
                        )}

                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </form>
        </>
      )
      }
    </div >
  );
}

