// aiflix/app/api/images/delete/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createService } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

export async function POST(req: Request) {
  const { path } = await req.json();

  if (!path) {
    return NextResponse.json({ error: 'path is required' }, { status: 400 });
  }

  // 1) Проверяем пользователя по кукам
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });
  }

  // 2) Удаляем файл и метаданные через service role
  const service = createService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
  );

  // 2.1 Удаляем из Storage (если уже удалён — это не критично)
  const delObj = await service.storage.from('images').remove([path]);
  if (delObj.error && !/not found/i.test(delObj.error.message ?? '')) {
    return NextResponse.json({ error: delObj.error.message }, { status: 500 });
  }

  // 2.2 Удаляем запись в БД только текущего пользователя
  const delMeta = await service
    .from('images_meta')
    .delete()
    .eq('path', path)
    .eq('user_id', user.id);

  if (delMeta.error) {
    return NextResponse.json({ error: delMeta.error.message }, { status: 500 });
  }

  // 3) Мгновенно сбрасываем ISR-кэш страниц со списком картинок
  // Если галерея есть и на главной — тоже сбросим.
  revalidatePath('/images');
  revalidatePath('/');

  return NextResponse.json({ ok: true });
}
