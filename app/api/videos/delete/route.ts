// aiflix/app/api/videos/delete/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createService } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

export async function POST(req: Request) {
    const { videoId } = await req.json();

    if (!videoId) {
        return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
    }

    // 1) Проверяем пользователя по кукам
    const supa = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Требуется вход' }, { status: 401 });
    }

    // 2) Удаляем через service role
    const service = createService(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2.1 Удаляем запись в БД только для текущего пользователя
    const delVideo = await service
        .from('films')
        .delete()
        .eq('id', videoId)
        .eq('author_id', user.id);

    if (delVideo.error) {
        return NextResponse.json({ error: delVideo.error.message }, { status: 500 });
    }

    // 3) Сбрасываем ISR кэш
    revalidatePath('/');
    revalidatePath(`/u/${user.id}`);

    return NextResponse.json({ ok: true });
}
