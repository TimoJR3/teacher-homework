-- Учебники на сайте: страницы лежат картинками в закрытом хранилище «books»,
-- преподаватель прикрепляет нужные страницы к заданию.
-- Ученик видит только страницы из своих заданий, целиком учебник открыт лишь преподавателю.

create table public.books (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  title text not null,
  -- Номера страниц совпадают с напечатанными в книге: 1..pages.
  pages int not null check (pages > 0),
  -- Страница с содержанием, с неё удобно начинать листать.
  contents_page int not null default 1
);

alter table public.books enable row level security;
create policy "books: читают все" on public.books
  for select to authenticated using (true);

insert into public.books (id, title, pages, contents_page)
values ('ef-pre-sb', 'English File Pre-Intermediate. Student''s Book', 168, 2)
on conflict (id) do nothing;

create table public.assignment_pages (
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  book_id text not null references public.books (id),
  page int not null check (page > 0),
  created_at timestamptz not null default now(),
  primary key (assignment_id, book_id, page)
);

alter table public.assignment_pages enable row level security;
create policy "assignment_pages: видят те, кому выдано задание" on public.assignment_pages
  for select to authenticated using (public.can_see_assignment(assignment_id));
create policy "assignment_pages: добавляет преподаватель" on public.assignment_pages
  for insert to authenticated with check (
    public.is_teacher()
    and page <= (select b.pages from public.books b where b.id = book_id)
  );
create policy "assignment_pages: удаляет преподаватель" on public.assignment_pages
  for delete to authenticated using (public.is_teacher());

-- Загружает страницы только администратор (ключ service_role), поэтому политики на запись нет.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('books', 'books', false, 5 * 1024 * 1024, array['image/jpeg'])
on conflict (id) do nothing;

-- Путь страницы: <книга>/<номер>.jpg, например ef-pre-sb/14.jpg.
create policy "books: страницы учебника" on storage.objects
  for select to authenticated using (
    bucket_id = 'books' and (
      public.is_teacher()
      or exists (
        select 1 from public.assignment_pages ap
        where objects.name = ap.book_id || '/' || ap.page || '.jpg'
          and public.can_see_assignment(ap.assignment_id)
      )
    )
  );
