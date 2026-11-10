-- Безопасность: почты больше не хранятся в открытых таблицах.
-- Выполнить один раз: Supabase → SQL Editor → вставить → Run. Можно запускать повторно.

-- 00. Правила, которые раньше опирались на почту, теперь опираются на id пользователя
drop policy if exists "Auth users can insert" on public.repositories;
create policy "Auth users can insert" on public.repositories
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Owner can update" on public.repositories;
create policy "Owner can update" on public.repositories
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "insert own comments" on public.comments;
create policy "insert own comments" on public.comments
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update own comments" on public.comments;
create policy "update own comments" on public.comments
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 0. Проверка: если какое-то правило доступа опирается на почту, скрипт остановится и ничего не изменит
do $$
declare bad text;
begin
  select string_agg(tablename || ': ' || policyname, ', ') into bad
  from pg_policies
  where schemaname = 'public'
    and (coalesce(qual, '') ilike '%email%' or coalesce(with_check, '') ilike '%email%')
    and policyname not like 'admin %';
  if bad is not null then
    raise exception 'Стоп: эти правила используют почту, пришли их Claude: %', bad;
  end if;
end $$;

-- 1. Стираем уже сохранённые почты
alter table public.profiles alter column email drop not null;
alter table public.repositories alter column author_email drop not null;
alter table public.comments alter column author_email drop not null;

update public.profiles set email = null where email is not null;
update public.repositories set author_email = null where author_email is not null;
update public.comments set author_email = null where author_email is not null;

-- 2. И не даём записать их снова (даже старой версией сайта)
create or replace function public.strip_profile_email()
returns trigger language plpgsql as $$
begin new.email := null; return new; end $$;

create or replace function public.strip_author_email()
returns trigger language plpgsql as $$
begin new.author_email := null; return new; end $$;

drop trigger if exists strip_email on public.profiles;
create trigger strip_email before insert or update on public.profiles
  for each row execute function public.strip_profile_email();
drop trigger if exists strip_email on public.repositories;
create trigger strip_email before insert or update on public.repositories
  for each row execute function public.strip_author_email();
drop trigger if exists strip_email on public.comments;
create trigger strip_email before insert or update on public.comments
  for each row execute function public.strip_author_email();

-- 3. Вход по нику: почту отдаём, только если пароль верный.
--    Не больше 10 попыток на ник за 15 минут.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.login_attempts (
  username text not null,
  at timestamptz not null default now()
);
alter table public.login_attempts enable row level security; -- с сайта не читается
create index if not exists login_attempts_idx on public.login_attempts (username, at);

create or replace function public.login_email(p_username text, p_password text)
returns text
language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  u auth.users%rowtype;
  n text := lower(trim(p_username));
begin
  delete from public.login_attempts where at < now() - interval '1 day';
  if (select count(*) from public.login_attempts
      where username = n and at > now() - interval '15 minutes') >= 10 then
    raise exception 'Слишком много попыток, подождите 15 минут';
  end if;
  insert into public.login_attempts (username) values (n);

  select a.* into u
  from auth.users a join public.profiles p on p.id = a.id
  where lower(p.username) = n
  limit 1;

  if u.id is null or u.encrypted_password is null
     or u.encrypted_password <> crypt(p_password, u.encrypted_password) then
    return null;
  end if;
  return u.email;
end $$;

revoke all on function public.login_email(text, text) from public;
grant execute on function public.login_email(text, text) to anon, authenticated;

-- 4. Аватарки: файлы по ссылке открываются, а список всех папок — только своя папка
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
             and cmd in ('SELECT', 'ALL') and coalesce(qual, '') ilike '%avatars%'
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

drop policy if exists "avatars own read" on storage.objects;
drop policy if exists "avatars own insert" on storage.objects;
drop policy if exists "avatars own update" on storage.objects;
create policy "avatars own read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
