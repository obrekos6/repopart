-- Безопасность, часть 2: просмотры.
-- Выполнить один раз: Supabase → SQL Editor → вставить → Run. Можно запускать повторно.

-- 1. Историю просмотров (кто что смотрел) с сайта не читает никто.
--    Счётчик просмотров живёт в repositories.views, его пишет track_view.
alter table public.post_views enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'post_views'
  loop
    execute format('drop policy %I on public.post_views', p.policyname);
  end loop;
end $$;

-- 2. Просмотр засчитывается только от себя: id берётся из входа, а не из запроса.
--    Раньше можно было подставить любой id и накрутить просмотры.
create or replace function public.track_view(p_post_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    return;
  end if;

  insert into public.post_views (post_id, user_id)
  values (p_post_id, auth.uid())
  on conflict do nothing;

  select count(*) into v_count from public.post_views where post_id = p_post_id;
  update public.repositories set views = v_count where id = p_post_id;
end $$;

revoke all on function public.track_view(uuid, uuid) from public, anon;
grant execute on function public.track_view(uuid, uuid) to authenticated;

-- 3. Файлы постов и аватарки: удалить и перезаписать можно только свой файл.
--    Раньше любой вошедший мог удалить или подменить чужое фото, а аноним — загружать файлы.
drop policy if exists "Allow public uploads f5c4y7_0" on storage.objects;
drop policy if exists "Auth upload" on storage.objects;
drop policy if exists "Auth update" on storage.objects;
drop policy if exists "files delete auth" on storage.objects;
drop policy if exists "files read all" on storage.objects;
drop policy if exists "Public read" on storage.objects;
drop policy if exists "avatar delete own" on storage.objects;
drop policy if exists "avatar update own" on storage.objects;
drop policy if exists "avatar upload own" on storage.objects;

-- файлы по прямой ссылке открываются и без этих правил (бакеты публичные)
drop policy if exists "files own read" on storage.objects;
create policy "files own read" on storage.objects for select to authenticated
  using (bucket_id = 'repopart-files' and (owner = auth.uid() or public.is_admin()));

drop policy if exists "files own delete" on storage.objects;
create policy "files own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'repopart-files' and owner = auth.uid());

drop policy if exists "avatars own delete" on storage.objects;
create policy "avatars own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- "files upload auth" (загрузка для вошедших) и "admin deletes post files" остаются

-- 4. Свои просмотры вручную не накрутить: их меняет только track_view
create or replace function public.guard_post_counters()
returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.views := old.views;
  end if;
  return new;
end $$;

drop trigger if exists guard_post_counters on public.repositories;
create trigger guard_post_counters before update on public.repositories
  for each row execute function public.guard_post_counters();

-- 5. Реакцию нельзя «переписать» на другого человека или другой пост
drop policy if exists "Users can update own reactions" on public.reactions;
create policy "Users can update own reactions" on public.reactions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6. Одна реакция от человека на пост и один просмотр от человека на пост.
--    Дубли, которые уже успели накрутить, убираются.
delete from public.reactions a using public.reactions b
  where a.repository_id = b.repository_id and a.user_id = b.user_id and a.ctid > b.ctid;
create unique index if not exists reactions_one_per_user on public.reactions (repository_id, user_id);

delete from public.post_views a using public.post_views b
  where a.post_id = b.post_id and a.user_id = b.user_id and a.ctid > b.ctid;
delete from public.post_views where user_id is null
   or user_id not in (select id from auth.users);
create unique index if not exists post_views_one_per_user on public.post_views (post_id, user_id);

-- пересчитать просмотры после чистки
update public.repositories r set views = coalesce(
  (select count(*) from public.post_views v where v.post_id = r.id), 0);

-- 7. Ограничение скорости: не больше 5 постов за 10 минут и 20 комментариев за минуту
create or replace function public.rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then return new; end if;
  if tg_table_name = 'repositories' then
    select count(*) into n from public.repositories
      where user_id = auth.uid() and created_at > now() - interval '10 minutes';
    if n >= 5 then raise exception 'Слишком часто, подождите несколько минут'; end if;
  else
    select count(*) into n from public.comments
      where user_id = auth.uid() and created_at > now() - interval '1 minute';
    if n >= 20 then raise exception 'Слишком часто, подождите минуту'; end if;
  end if;
  return new;
end $$;

drop trigger if exists rate_limit on public.repositories;
create trigger rate_limit before insert on public.repositories
  for each row execute function public.rate_limit();
drop trigger if exists rate_limit on public.comments;
create trigger rate_limit before insert on public.comments
  for each row execute function public.rate_limit();

-- 8. Забаненный не может и редактировать свои посты и комментарии
drop trigger if exists block_banned_update on public.repositories;
create trigger block_banned_update before update on public.repositories
  for each row when (current_user = 'authenticated') execute function public.block_banned();
drop trigger if exists block_banned_update on public.comments;
create trigger block_banned_update before update on public.comments
  for each row when (current_user = 'authenticated') execute function public.block_banned();

-- 9. Ник уникален без учёта регистра: нельзя завести «Obrekos» рядом с «obrekos»
do $$
begin
  create unique index if not exists profiles_username_unique on public.profiles (lower(username));
exception when unique_violation then
  raise notice 'Есть одинаковые ники, индекс не создан — пришли это Claude';
end $$;

-- 10. Аватарка — только картинка и не больше 5 МБ
update storage.buckets
  set file_size_limit = 5242880, allowed_mime_types = array['image/*']
  where id = 'avatars';
