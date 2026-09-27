-- Выдача задания конкретным ученикам.
-- Если у задания нет строк в assignment_students, его видят все ученики.

create table public.assignment_students (
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  primary key (assignment_id, student_id)
);

create index assignment_students_student_idx on public.assignment_students (student_id);

-- security definer: ученику нельзя видеть, кому ещё выдано задание,
-- но проверить «выдано ли оно мне» нужно по всем строкам.
create function public.can_see_assignment(aid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_teacher()
    or not exists (select 1 from public.assignment_students where assignment_id = aid)
    or exists (
      select 1 from public.assignment_students
      where assignment_id = aid and student_id = auth.uid()
    );
$$;

alter table public.assignment_students enable row level security;

create policy "assignment_students: преподаватель" on public.assignment_students
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy "assignment_students: свои строки" on public.assignment_students
  for select to authenticated using (student_id = auth.uid());

drop policy "assignments: читают все" on public.assignments;
create policy "assignments: кому выдано" on public.assignments
  for select to authenticated using (public.can_see_assignment(id));

drop policy "submissions: ученик сдаёт свою" on public.submissions;
create policy "submissions: ученик сдаёт свою" on public.submissions
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and status = 'submitted'
    and not public.is_teacher()
    and public.can_see_assignment(assignment_id)
  );
