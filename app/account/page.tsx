// aiflix/app/account/page.tsx (SERVER)
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import AccountClient from './AccountClient';

export default async function AccountPage() {
  const supabase = createServerComponentClient({ cookies });

  // сессия
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return (
      <div className="max-w-5xl p-6">
        <h1 className="mb-6 text-3xl font-bold">Личный кабинет</h1>
        <p className="text-gray-700">
          Войдите, чтобы управлять загрузками. <a className="underline" href="/upload">Войти</a>
        </p>
      </div>
    );
  }

  // username
  const { data: prof } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', session.user.id)
    .maybeSingle();

  // видео
  const { data: films } = await supabase
    .from('films')
    .select('id,user_id,title,description,playback_id,upload_id,created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  // картинки
  const { data: imgs } = await supabase
    .from('images_meta')
    .select('id,user_id,path,title,description,created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  // построим publicUrl на сервере (это чистая функция)
  const images =
    (imgs ?? []).map((m) => {
      const { data } = supabase.storage.from('images').getPublicUrl(m.path);
      return { meta: m, url: data.publicUrl };
    }) ?? [];

  return (
    <AccountClient
      initialUsername={prof?.username ?? null}
      initialFilms={films ?? []}
      initialImages={images}
    />
  );
}
