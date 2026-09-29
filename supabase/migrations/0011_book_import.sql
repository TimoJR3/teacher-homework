-- Преподаватель сам загружает учебник: сайт режет PDF на страницы прямо в браузере
-- и кладёт их в хранилище «books» под правами преподавателя.

-- Сдвиг нумерации: напечатанная страница N — это страница N + pdf_offset в PDF.
-- У English File первая страница PDF — обложка, поэтому сдвиг 1.
alter table public.books add column pdf_offset int not null default 0 check (pdf_offset >= 0);
update public.books set pdf_offset = 1 where id = 'ef-pre-sb';

create policy "books: добавляет преподаватель" on public.books
  for insert to authenticated with check (public.is_teacher());

create policy "books: загружает страницы преподаватель" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'books'
    and public.is_teacher()
    and exists (select 1 from public.books b where objects.name like b.id || '/%')
  );
