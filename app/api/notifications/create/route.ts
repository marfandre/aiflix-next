import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
    try {
        const { target, targetId, ownerId } = await req.json();

        // target: 'film' | 'image'
        // targetId: ID фильма или картинки
        // ownerId: ID владельца контента

        if (!target || !targetId || !ownerId) {
            return NextResponse.json({ error: 'Missing params' }, { status: 400 });
        }

        const supa = createRouteHandlerClient({ cookies });
        const { data: { user } } = await supa.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Не создаём уведомление если лайкаешь свой контент
        if (user.id === ownerId) {
            return NextResponse.json({ ok: true, skipped: true });
        }

        // Используем service role для вставки
        const service = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error } = await service.from('notifications').insert({
            user_id: ownerId,
            from_user_id: user.id,
            type: 'like',
            film_id: target === 'film' ? targetId : null,
            image_id: target === 'image' ? targetId : null,
        });

        if (error) {
            console.error('create notification error:', error);
            // Не возвращаем ошибку — уведомление не критично
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error('notifications/create error:', e);
        return NextResponse.json({ error: e?.message }, { status: 500 });
    }
}
