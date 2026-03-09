// aiflix/app/api/videos/delete/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createService } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import Mux from '@mux/mux-node';

const mux = new Mux({
    tokenId: process.env.MUX_TOKEN_ID!,
    tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

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

    // 2.1 Находим видео, чтобы узнать его Mux asset_id перед удалением
    const { data: videoData, error: viewError } = await service
        .from('films')
        .select('asset_id')
        .eq('id', videoId)
        .eq('author_id', user.id)
        .single();

    if (viewError || !videoData) {
        return NextResponse.json({ error: 'Видео не найдено или нет прав' }, { status: 404 });
    }

    // 2.2 Удаляем видео с серверов Mux (если asset_id существует)
    if (videoData.asset_id) {
        try {
            await mux.video.assets.delete(videoData.asset_id);
            console.log(`Successfully deleted Mux asset: ${videoData.asset_id}`);
        } catch (muxError: any) {
            console.error('Failed to delete Mux asset:', muxError);
            // Если Mux вернул 404 (видео уже удалено оттуда вручную), то не считаем это критической ошибкой
            if (muxError?.status !== 404) {
                return NextResponse.json({ error: 'Ошибка при удалении видео с серверов Mux' }, { status: 500 });
            }
        }
    }

    // 2.3 Удаляем запись в БД только для текущего пользователя
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
