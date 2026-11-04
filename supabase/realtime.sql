-- Включает обновления в реальном времени для постов, комментариев и лайков.
-- Выполнить один раз: Supabase → SQL Editor → вставить → Run.
--
-- Сайт уже подписан на изменения этих таблиц (лента, комментарии, счётчики),
-- но Supabase присылает события только по таблицам из публикации supabase_realtime.

-- 1. Добавить таблицы в публикацию.
--    Если какая-то таблица уже там, Postgres ответит «is already member of publication» —
--    тогда выполните строки по одной, пропустив эту таблицу.
alter publication supabase_realtime add table public.repositories;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.reactions;

-- 2. Чтобы удаления тоже приходили с фильтром (например, «удалён комментарий у поста X»),
--    в событии должна быть вся старая строка, а не только id.
alter table public.repositories replica identity full;
alter table public.comments replica identity full;
alter table public.reactions replica identity full;

-- Проверка: какие таблицы сейчас в публикации
select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime';
