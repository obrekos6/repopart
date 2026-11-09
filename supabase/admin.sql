-- Админ-панель: галочки, баны, удаление чужих постов и комментариев.
-- Выполнить один раз: Supabase → SQL Editor → вставить → Run.
-- Можно запускать повторно. Права проверяет база, а не сайт: подделать запрос из браузера нельзя.

-- 1. Поля в профиле
alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.profiles add column if not exists is_banned boolean not null default false;

-- 2. Кто администратор
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'obrekos6@gmail.com'
$$;

-- 3. Сам себе галочку не выдать и бан не снять: эти поля меняет только администратор
create or replace function public.guard_profile_flags()
returns trigger language plpgsql as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new; -- SQL Editor и администратор
  end if;
  if tg_op = 'INSERT' then
    new.is_verified := false;
    new.is_banned := false;
  else
    new.is_verified := old.is_verified;
    new.is_banned := old.is_banned;
  end if;
  return new;
end $$;

drop trigger if exists guard_profile_flags on public.profiles;
create trigger guard_profile_flags before insert or update on public.profiles
  for each row execute function public.guard_profile_flags();

-- 4. Забаненный не может публиковать, комментировать и ставить реакции
create or replace function public.block_banned()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where id = auth.uid() and is_banned) then
    raise exception 'Аккаунт заблокирован';
  end if;
  return new;
end $$;

drop trigger if exists block_banned on public.repositories;
create trigger block_banned before insert on public.repositories
  for each row execute function public.block_banned();
drop trigger if exists block_banned on public.comments;
create trigger block_banned before insert on public.comments
  for each row execute function public.block_banned();
drop trigger if exists block_banned on public.reactions;
create trigger block_banned before insert on public.reactions
  for each row execute function public.block_banned();

-- 5. Права администратора
drop policy if exists "admin updates profiles" on public.profiles;
create policy "admin updates profiles" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin deletes posts" on public.repositories;
create policy "admin deletes posts" on public.repositories
  for delete to authenticated using (public.is_admin());

drop policy if exists "admin deletes comments" on public.comments;
create policy "admin deletes comments" on public.comments
  for delete to authenticated using (public.is_admin());

drop policy if exists "admin deletes post files" on storage.objects;
create policy "admin deletes post files" on storage.objects
  for delete to authenticated using (bucket_id = 'repopart-files' and public.is_admin());

-- 6. Твоя галочка, которая раньше была прописана в коде
update public.profiles p set is_verified = true
from auth.users u
where u.id = p.id and u.email = 'obrekos6@gmail.com';
