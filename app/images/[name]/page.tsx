import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import MediaTabs from '../../components/MediaTabs';

type Props = { params: { name: string } };

export const revalidate = 60;

export default async function ImageViewPage({ params }: Props) {
  const name = decodeURIComponent(params.name);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Проверяем существование файла (опционально)
  const { data, error } = await supabase
    .storage
    .from('images')
    .list('uploads', { search: name });

  const exists = (data ?? []).some((f) => f.name === name);
  if (error || !exists) return notFound();

  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/uploads/${encodeURIComponent(
    name
  )}`;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <MediaTabs />

      <div className="mt-6 mb-4 flex items-center justify-between">
        <Link href="/images" className="text-sm px-3 py-1.5 rounded border hover:bg-gray-50">
          ← Назад к картинкам
        </Link>
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm px-3 py-1.5 rounded border hover:bg-gray-50"
        >
          Открыть оригинал
        </a>
      </div>

      <div className="overflow-hidden shadow-sm">
        <img src={publicUrl} alt={name} className="w-full h-auto rounded-none" />
      </div>

      <div className="text-sm text-gray-500 mt-3 break-all">{name}</div>
    </div>
  );
}
