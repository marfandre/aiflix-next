import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createService } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { filename } = await req.json();

    // 1) Юзер из куки (обязателен)
    const supa = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userErr } = await supa.auth.getUser();
    if (userErr) console.error('auth.getUser error:', userErr);
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    // 2) service-role только для выдачи signed upload URL
    const service = createService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const filePath = `uploads/${Date.now()}_${filename}`;

    // 3) Выдаём клиенту одноразовый URL для загрузки файла
    const { data, error } = await service
      .storage
      .from('images')
      .createSignedUploadUrl(filePath);

    if (error || !data) {
      console.error('createSignedUploadUrl error:', error);
      return NextResponse.json(
        { error: `Signed URL error: ${error?.message ?? 'unknown'}` },
        { status: 500 }
      );
    }

    // ⚠️ Никаких вставок в images_meta здесь больше не делаем!
    return NextResponse.json({ uploadUrl: data.signedUrl, path: filePath });
  } catch (err: any) {
    console.error('images/start fatal:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Server error' },
      { status: 500 }
    );
  }
}
