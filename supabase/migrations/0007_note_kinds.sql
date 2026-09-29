-- Виды записей в блокноте ученика: правило, слово или обычная заметка.
-- Выполните этот файл целиком в Supabase: SQL Editor → New query → Run.

alter table public.notes
  add column kind text not null default 'note' check (kind in ('rule', 'word', 'note'));
