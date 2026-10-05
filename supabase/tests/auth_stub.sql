-- Заглушка схемы auth и ролей Supabase, чтобы проверить миграцию на обычном Postgres.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
grant usage on schema public to anon, authenticated;
-- Как в Supabase: новые таблицы по умолчанию доступны и гостю, и вошедшему, закрывает их RLS.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to authenticated;
-- Заглушка хранилища файлов Supabase.
create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
  name text, owner uuid default auth.uid());
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant all on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;
-- Заглушка Supabase Realtime: сообщения каналов и название текущего канала.
create schema realtime;
create table realtime.messages (id bigserial primary key, topic text not null, extension text not null, payload jsonb);
alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
grant usage on schema realtime to authenticated;
grant all on realtime.messages to authenticated;
grant usage on sequence realtime.messages_id_seq to authenticated;
grant execute on function realtime.topic() to authenticated;
