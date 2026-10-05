-- Доска для занятия: преподаватель открывает страницу учебника (или чистый лист),
-- он и ученик рисуют и пишут на ней, и каждый сразу видит, что делает другой.

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  teacher_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  -- Что открыто сейчас: страница учебника или чистый лист (book_id is null, page — номер листа).
  book_id text references public.books (id),
  page int not null default 1 check (page between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index boards_student on public.boards (student_id);

-- Участник доски: её ученик или преподаватель.
create function public.can_use_board(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.boards b
    where b.id = bid and (b.student_id = auth.uid() or public.is_teacher())
  );
$$;
revoke execute on function public.can_use_board(uuid) from public, anon;
grant execute on function public.can_use_board(uuid) to authenticated;

alter table public.boards enable row level security;
create policy "boards: участники видят" on public.boards
  for select to authenticated using (student_id = auth.uid() or public.is_teacher());
create policy "boards: создаёт преподаватель" on public.boards
  for insert to authenticated with check (
    public.is_teacher()
    and exists (select 1 from public.profiles p where p.id = student_id and p.role = 'student')
  );
-- Страницы листает преподаватель, ученик следует за ним.
create policy "boards: меняет преподаватель" on public.boards
  for update to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy "boards: удаляет преподаватель" on public.boards
  for delete to authenticated using (public.is_teacher());

-- Какие страницы учебника открывались на доске: ученик может смотреть именно их.
create table public.board_pages (
  board_id uuid not null references public.boards (id) on delete cascade,
  book_id text not null references public.books (id),
  page int not null check (page > 0),
  opened_at timestamptz not null default now(),
  primary key (board_id, book_id, page)
);
alter table public.board_pages enable row level security;
create policy "board_pages: видят участники" on public.board_pages
  for select to authenticated using (public.can_use_board(board_id));
create policy "board_pages: открывает преподаватель" on public.board_pages
  for insert to authenticated with check (
    public.is_teacher()
    and public.can_use_board(board_id)
    and page <= (select b.pages from public.books b where b.id = book_id)
  );

-- Линии и надписи. Координаты в точках листа шириной 1000, поэтому рисунок
-- одинаково ложится на страницу на телефоне и на большом экране.
create table public.board_strokes (
  -- id задаёт браузер: так рисунок сразу виден у второго участника и не дублируется.
  id uuid primary key,
  board_id uuid not null references public.boards (id) on delete cascade,
  book_id text references public.books (id),
  page int not null check (page between 1 and 2000),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  tool text not null check (tool in ('pen', 'marker', 'text')),
  color text not null check (color ~ '^#[0-9a-f]{6}$'),
  size real not null check (size > 0 and size <= 80),
  points jsonb not null default '[]' check (jsonb_typeof(points) = 'array' and pg_column_size(points) <= 65536),
  body text not null default '' check (char_length(body) <= 1000),
  created_at timestamptz not null default now()
);
create index board_strokes_sheet on public.board_strokes (board_id, book_id, page);

alter table public.board_strokes enable row level security;
create policy "board_strokes: видят участники" on public.board_strokes
  for select to authenticated using (public.can_use_board(board_id));
create policy "board_strokes: рисуют участники" on public.board_strokes
  for insert to authenticated with check (author_id = auth.uid() and public.can_use_board(board_id));
-- Ученик стирает своё, преподаватель — что угодно на своих досках.
create policy "board_strokes: стирают" on public.board_strokes
  for delete to authenticated using (
    public.can_use_board(board_id) and (author_id = auth.uid() or public.is_teacher())
  );

revoke all on public.boards, public.board_pages, public.board_strokes from anon;

-- Ученик видит страницы учебника, которые преподаватель открывал на его доске.
create policy "books: страницы с доски" on storage.objects
  for select to authenticated using (
    bucket_id = 'books'
    and exists (
      select 1 from public.board_pages bp
      join public.boards b on b.id = bp.board_id
      where b.student_id = auth.uid()
        and objects.name = bp.book_id || '/' || bp.page || '.jpg'
    )
  );

-- Живая доска: штрихи во время рисования и перелистывание идут через закрытый канал
-- Supabase Realtime «board:<id>». Подключиться к нему могут только участники доски.
create function public.can_use_board_topic(topic text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.boards b
    where 'board:' || b.id::text = topic and (b.student_id = auth.uid() or public.is_teacher())
  );
$$;
revoke execute on function public.can_use_board_topic(text) from public, anon;
grant execute on function public.can_use_board_topic(text) to authenticated;

create policy "доска: участники слушают" on realtime.messages
  for select to authenticated using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.can_use_board_topic(realtime.topic())
  );
create policy "доска: участники передают" on realtime.messages
  for insert to authenticated with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.can_use_board_topic(realtime.topic())
  );
