-- Extensions
create extension if not exists pg_trgm;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  avatar_url text,
  created_at timestamptz default now()
);

-- Films
create table if not exists public.films (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users (id) on delete set null,
  title text not null,
  description text,
  duration_seconds int,
  playback_id text,
  asset_id text,
  thumb_url text,
  visibility text default 'public' check (visibility in ('public','unlisted','private')),
  ai_models text[],
  genres text[],
  tools jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Likes
create table if not exists public.likes (
  user_id uuid references auth.users (id) on delete cascade,
  film_id uuid references public.films (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, film_id)
);

-- Comments
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  film_id uuid references public.films (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists films_title_trgm on public.films using gin (title gin_trgm_ops);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.films    enable row level security;
alter table public.likes    enable row level security;
alter table public.comments enable row level security;

-- Policies
create policy "profiles_read_all" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create policy "films_read_public" on public.films for select using (visibility = 'public' or author_id = auth.uid());
create policy "films_insert_auth" on public.films for insert with check (author_id = auth.uid());
create policy "films_update_own" on public.films for update using (author_id = auth.uid());

create policy "likes_insert_auth" on public.likes for insert with check (auth.uid() = user_id);
create policy "likes_delete_own" on public.likes for delete using (auth.uid() = user_id);

create policy "comments_read_all" on public.comments for select using (true);
create policy "comments_cud_auth" on public.comments
  for all using (auth.uid() = author_id) with check (auth.uid() = author_id);
