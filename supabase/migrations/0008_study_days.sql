-- Дни занятий ученика: по ним считается, сколько дней подряд он занимается.
-- Выполните этот файл целиком в Supabase: SQL Editor → New query → Run.

create table public.study_days (
  student_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null default (now() at time zone 'Europe/Moscow')::date,
  primary key (student_id, day)
);

alter table public.study_days enable row level security;

create policy "study_days: свои" on public.study_days
  for select to authenticated using (student_id = auth.uid());

-- Отметить можно только сегодняшний день и только себя, чтобы серию нельзя было «нарисовать».
create policy "study_days: ученик отмечает сегодня" on public.study_days
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and not public.is_teacher()
    and day = (now() at time zone 'Europe/Moscow')::date
  );

-- Отметить сегодняшний день; повторная отметка ничего не меняет.
create function public.mark_study_day() returns void
language sql security invoker set search_path = public as $$
  insert into public.study_days default values on conflict do nothing;
$$;

revoke execute on function public.mark_study_day() from public, anon;
grant execute on function public.mark_study_day() to authenticated;
