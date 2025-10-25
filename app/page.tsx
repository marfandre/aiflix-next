import MediaTabs from '@/components/MediaTabs'
import MediaCard from '@/components/MediaCard'
import { createClient } from '@/lib/supabase-server'
import type { Film } from './_types/media' 

export const revalidate = 60

export default async function Home({ searchParams }: { searchParams?: { type?: 'video' | 'image' } }) {
  const type = searchParams?.type === 'image' ? 'image' : 'video'
  const supabase = createClient()
  const { data, error } = await supabase
    .from('films')
    .select('*')
    .eq('media_type', type)
    .order('created_at', { ascending: false })
    .limit(48)

  if (error) throw new Error(error.message)
  const items = (data ?? []) as Film[]

  return (
    <main className="mx-auto max-w-6xl px-4">
      <MediaTabs />
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <MediaCard key={item.id} item={item} />
        ))}
      </div>
    </main>
  )
}
