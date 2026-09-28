-- Блокнот ученика: личные заметки и главное, что стоит запомнить.
-- Выполните этот файл целиком в Supabase: SQL Editor → New query → Run.

-- Заметки видит только сам ученик, преподавателю они не показываются.
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) > 0 and length(body) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_student_idx on public.notes (student_id, created_at desc);

alter table public.notes enable row level security;

create policy "notes: только свои" on public.notes
  for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid() and not public.is_teacher());

-- Заметку нельзя передать другому ученику, дата изменения ставится сама.
create function public.guard_note_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.student_id <> old.student_id then
    raise exception 'Нельзя передать заметку другому ученику';
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger notes_guard_update
  before update on public.notes
  for each row execute function public.guard_note_update();
