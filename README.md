# AIFLIX — AI‑фильмы (MVP)

## Быстрый старт локально
1) Создай проект в Supabase → выполни SQL из `schema.sql` → включи RLS и политики.
2) Скопируй `.env.local.example` в `.env.local` и заполни ключи.
3) Установи зависимости: `npm i` (или `pnpm i`).
4) Запусти: `npm run dev` → http://localhost:3000
5) В Mux создай токены и webhook на `/api/mux/webhook`.
6) Загрузить файл → дождаться обработки → открыть страницу фильма.

## Деплой на Vercel
1) Залей в GitHub.
2) Импортируй на Vercel как Next.js проект.
3) Добавь переменные окружения из `.env.local` в проект на Vercel.
4) Укажи в Mux webhook: `https://<твой-домен>/api/mux/webhook`.

## Стек
Next.js 14, Supabase (Postgres/Auth), Mux (видео), TailwindCSS.
