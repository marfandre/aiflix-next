-- migrations/027_auto_create_profile.sql
-- При регистрации пользователя в auth.users автоматически создаём строку
-- в public.profiles с дефолтным ником вида "{email-local-part}_{6 символов uuid}".
-- Если email пустой/невалидный — фолбэк "user_{6 символов uuid}".
--
-- Также бэкфилит уже существующих пользователей, у которых ещё нет profiles.
-- После триггера пользователь сразу сможет открыть свой /u и переименовать ник
-- через "Редактировать профиль".

-- 1. Функция-генератор и триггер
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name   text;
  uuid_suffix text;
  candidate   text;
begin
  uuid_suffix := substring(replace(new.id::text, '-', ''), 1, 6);

  base_name := lower(regexp_replace(coalesce(split_part(new.email, '@', 1), ''), '[^a-z0-9_]', '', 'g'));

  if base_name is null or length(base_name) < 2 then
    candidate := 'user_' || uuid_suffix;
  else
    -- ограничиваем base_name 25 символами, чтобы итог влез в разумные рамки
    candidate := substring(base_name, 1, 25) || '_' || uuid_suffix;
  end if;

  insert into public.profiles (id, username)
  values (new.id, candidate)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- 2. Триггер на auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Бэкфил существующих пользователей без profiles
insert into public.profiles (id, username)
select
  u.id,
  case
    when length(regexp_replace(coalesce(split_part(u.email, '@', 1), ''), '[^a-z0-9_]', '', 'g')) >= 2
      then substring(
             lower(regexp_replace(split_part(u.email, '@', 1), '[^a-z0-9_]', '', 'g')),
             1, 25
           ) || '_' || substring(replace(u.id::text, '-', ''), 1, 6)
    else 'user_' || substring(replace(u.id::text, '-', ''), 1, 6)
  end
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
