-- Создание и изменение задания одной операцией, удаление без потери сданных работ.

-- Работы учеников не должны пропадать вместе с заданием: удалить можно только
-- задание, которое ещё никто не сдал.
alter table public.submissions drop constraint submissions_assignment_id_fkey;
alter table public.submissions
  add constraint submissions_assignment_id_fkey
  foreign key (assignment_id) references public.assignments (id) on delete restrict;

-- Пустой или null список учеников означает «всем».
-- security invoker: работают обычные права (RLS), функция лишь делает всё атомарно.
create function public.create_assignment(
  p_title text,
  p_description text,
  p_due_at timestamptz,
  p_student_ids uuid[]
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  new_id uuid;
begin
  if not public.is_teacher() then
    raise exception 'Создавать задания может только преподаватель';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'Укажите название задания';
  end if;

  insert into public.assignments (title, description, due_at)
  values (trim(p_title), coalesce(p_description, ''), p_due_at)
  returning id into new_id;

  insert into public.assignment_students (assignment_id, student_id)
  select new_id, sid from unnest(coalesce(p_student_ids, '{}')) as sid;

  return new_id;
end;
$$;

create function public.update_assignment(
  p_id uuid,
  p_title text,
  p_description text,
  p_due_at timestamptz,
  p_student_ids uuid[]
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  ids uuid[] := coalesce(p_student_ids, '{}');
begin
  if not public.is_teacher() then
    raise exception 'Менять задания может только преподаватель';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'Укажите название задания';
  end if;

  -- Нельзя забрать задание у ученика, который его уже сдал.
  if cardinality(ids) > 0 and exists (
    select 1 from public.submissions
    where assignment_id = p_id and not (student_id = any (ids))
  ) then
    raise exception 'Нельзя убрать ученика, который уже сдал это задание';
  end if;

  update public.assignments
  set title = trim(p_title), description = coalesce(p_description, ''), due_at = p_due_at
  where id = p_id;
  if not found then
    raise exception 'Задание не найдено';
  end if;

  delete from public.assignment_students where assignment_id = p_id;
  insert into public.assignment_students (assignment_id, student_id)
  select p_id, sid from unnest(ids) as sid;
end;
$$;

revoke execute on function public.create_assignment(text, text, timestamptz, uuid[]) from public, anon;
revoke execute on function public.update_assignment(uuid, text, text, timestamptz, uuid[]) from public, anon;
grant execute on function public.create_assignment(text, text, timestamptz, uuid[]) to authenticated;
grant execute on function public.update_assignment(uuid, text, text, timestamptz, uuid[]) to authenticated;
