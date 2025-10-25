// app/api/images/start/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; // серверный ключ
const BUCKET = process.env.SUPABASE_IMAGES_BUCKET || 'images'; // создай такой bucket в Storage

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const filename: string | undefined = body?.filename; // пришлёт клиент
    const title: string | null = body?.title ?? null;
    const description: string | null = body?.description ?? null;

    if (!filename) {
      return NextResponse.json({ error: 'filename is required' }, { status: 400 });
    }

    // уникальный путь (оставляем расширение файла)
    const ext = filename.includes('.') ? filename.split('.').pop() : 'bin';
    const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // сервисный клиент
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // подписываем upload url (время жизни по умолчанию ~ 2 мин)
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Cannot create signed upload url' }, { status: 500 });
    }

    // (по желанию) можешь здесь создать запись в БД об изображении и вернуть её id

    // клиенту достаточно bucket + path + token
    return NextResponse.json({
      bucket: BUCKET,
      path,             // путь, в который надо грузить
      token: data.token // токен для uploadToSignedUrl
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
