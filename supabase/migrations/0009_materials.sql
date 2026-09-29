-- Материалы к заданию: ссылка на страницы учебника и прикреплённые файлы (PDF, фото страниц).

alter table public.assignments
  add column textbook text not null default '' check (char_length(textbook) <= 300);

-- Файлы лежат в закрытом хранилище «materials», здесь их описание.
-- Путь в хранилище: <id задания>/<случайное имя>. Исходное имя файла храним отдельно,
-- потому что хранилище не принимает русские буквы в путях.
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  path text not null unique check (path like assignment_id::text || '/%'),
  name text not null check (char_length(name) between 1 and 200),
  size bigint not null default 0 check (size >= 0),
  mime text not null default '',
  created_at timestamptz not null default now()
);
create index materials_assignment_idx on public.materials (assignment_id);

alter table public.materials enable row level security;
create policy "materials: видят те, кому выдано задание" on public.materials
  for select to authenticated using (public.can_see_assignment(assignment_id));
create policy "materials: добавляет преподаватель" on public.materials
  for insert to authenticated with check (public.is_teacher());
create policy "materials: удаляет преподаватель" on public.materials
  for delete to authenticated using (public.is_teacher());

-- Закрытое хранилище: файлы отдаются только по временным ссылкам.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', false, 20 * 1024 * 1024,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Файл видит преподаватель и ученики, которым выдано задание с этим файлом.
create policy "materials: читать файлы задания" on storage.objects
  for select to authenticated using (
    bucket_id = 'materials' and (
      public.is_teacher()
      or exists (
        select 1 from public.materials m
        where m.path = objects.name and public.can_see_assignment(m.assignment_id)
      )
    )
  );
create policy "materials: загружает преподаватель" on storage.objects
  for insert to authenticated with check (bucket_id = 'materials' and public.is_teacher());
create policy "materials: удаляет файлы преподаватель" on storage.objects
  for delete to authenticated using (bucket_id = 'materials' and public.is_teacher());
