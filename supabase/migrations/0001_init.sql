-- Схема первой версии: преподаватель, ученики, задания, сдачи, пометки к ошибкам.
-- Выполните этот файл целиком в Supabase: SQL Editor → New query → Run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Пользователи
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'student' check (role in ('teacher', 'student')),
  created_at timestamptz not null default now()
);

-- Каждый новый пользователь автоматически становится учеником.
-- Преподавателя назначают вручную (см. README).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher');
$$;

-- ---------------------------------------------------------------------------
-- Темы ошибок
-- ---------------------------------------------------------------------------
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  rule text not null default '',
  sort_order int not null default 0
);

insert into public.topics (name, rule, sort_order) values
  ('Времена глагола', 'Past Simple, Present Perfect, Past Perfect и их различия', 10),
  ('Артикли a / an / the', 'исчисляемые и неисчисляемые, первое упоминание и уже известное', 20),
  ('Предлоги', 'in / on / at, предлоги после глаголов, случаи без предлога', 30),
  ('Согласование подлежащего и сказуемого', 'he / she / it + -s, there is / there are', 40),
  ('Порядок слов', 'вопросы, место наречий', 50),
  ('Лексика и словоупотребление', 'make / do, say / tell и похожие пары', 60),
  ('Орфография', '', 70),
  ('Пунктуация', '', 80);

-- ---------------------------------------------------------------------------
-- Задания, сдачи, пометки
-- ---------------------------------------------------------------------------
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  due_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Статусы: submitted (сдано) → returned (на исправлении) → fixed (исправлено)
--          → returned ... → accepted (принято)
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  status text not null default 'submitted'
    check (status in ('submitted', 'returned', 'fixed', 'accepted')),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

-- Пометка хранит позицию фрагмента в тексте (в символах) и копию фрагмента,
-- чтобы её можно было показать, даже если позиции когда-нибудь разойдутся.
create table public.marks (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  start_offset int not null check (start_offset >= 0),
  end_offset int not null check (end_offset > start_offset),
  quote text not null,
  topic_id uuid not null references public.topics (id),
  comment text not null default '',
  student_fix text not null default '',
  created_at timestamptz not null default now()
);

create index marks_submission_idx on public.marks (submission_id);
create index submissions_student_idx on public.submissions (student_id);

-- ---------------------------------------------------------------------------
-- Правила переходов, которые нельзя обойти прямым запросом к API
-- ---------------------------------------------------------------------------
create function public.guard_submission_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.assignment_id <> old.assignment_id or new.student_id <> old.student_id then
    raise exception 'Нельзя переносить работу в другое задание или другому ученику';
  end if;

  if public.is_teacher() then
    if new.body <> old.body then
      raise exception 'Преподаватель не меняет текст ученика, только ставит пометки';
    end if;
    if new.status <> old.status and not (
      (old.status in ('submitted', 'fixed') and new.status in ('returned', 'accepted'))
    ) then
      raise exception 'Недопустимый переход статуса: % → %', old.status, new.status;
    end if;
  else
    -- Ученик может только отправить исправления по возвращённой работе.
    if not (old.status = 'returned' and new.status = 'fixed' and new.body = old.body) then
      raise exception 'Эту работу сейчас нельзя изменить';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger submissions_guard
  before update on public.submissions
  for each row execute function public.guard_submission_update();

create function public.guard_mark_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  sub_status text;
begin
  if public.is_teacher() then
    if new.student_fix <> old.student_fix then
      raise exception 'Исправление пишет ученик';
    end if;
    return new;
  end if;

  select status into sub_status from public.submissions where id = old.submission_id;
  if sub_status <> 'returned' then
    raise exception 'Исправлять можно только работу, возвращённую на исправление';
  end if;
  if new.submission_id <> old.submission_id
     or new.start_offset <> old.start_offset
     or new.end_offset <> old.end_offset
     or new.quote <> old.quote
     or new.topic_id <> old.topic_id
     or new.comment <> old.comment then
    raise exception 'Ученик может менять только своё исправление';
  end if;
  return new;
end;
$$;

create trigger marks_guard
  before update on public.marks
  for each row execute function public.guard_mark_update();

-- ---------------------------------------------------------------------------
-- Row Level Security: ученик видит только своё
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.topics enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.marks enable row level security;

create policy "profiles: свой или преподаватель" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_teacher());
create policy "profiles: своё имя" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Роль нельзя поменять самому себе: колонку role обновлять запрещено.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

create policy "topics: читают все" on public.topics
  for select to authenticated using (true);
create policy "topics: меняет преподаватель" on public.topics
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

create policy "assignments: читают все" on public.assignments
  for select to authenticated using (true);
create policy "assignments: меняет преподаватель" on public.assignments
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

create policy "submissions: свои или преподаватель" on public.submissions
  for select to authenticated using (student_id = auth.uid() or public.is_teacher());
create policy "submissions: ученик сдаёт свою" on public.submissions
  for insert to authenticated
  with check (student_id = auth.uid() and status = 'submitted' and not public.is_teacher());
create policy "submissions: обновление" on public.submissions
  for update to authenticated
  using (student_id = auth.uid() or public.is_teacher())
  with check (student_id = auth.uid() or public.is_teacher());

create policy "marks: свои или преподаватель" on public.marks
  for select to authenticated using (
    public.is_teacher()
    or exists (select 1 from public.submissions s where s.id = submission_id and s.student_id = auth.uid())
  );
create policy "marks: ставит преподаватель" on public.marks
  for insert to authenticated with check (
    public.is_teacher()
    and exists (select 1 from public.submissions s
                where s.id = submission_id and s.status in ('submitted', 'fixed'))
  );
create policy "marks: удаляет преподаватель" on public.marks
  for delete to authenticated using (public.is_teacher());
create policy "marks: обновление" on public.marks
  for update to authenticated using (
    public.is_teacher()
    or exists (select 1 from public.submissions s where s.id = submission_id and s.student_id = auth.uid())
  );
