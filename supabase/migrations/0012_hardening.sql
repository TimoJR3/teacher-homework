-- Аудит безопасности: ограничения длины, скрытые пометки до проверки, закрытие таблиц от гостей.

-- Длина текстов проверяется и на сайте, и здесь: через API в обход сайта
-- нельзя записать мегабайты текста в имя или комментарий.
alter table public.profiles
  add constraint profiles_full_name_len check (char_length(full_name) <= 100);
alter table public.assignments
  add constraint assignments_title_len check (char_length(title) <= 200),
  add constraint assignments_description_len check (char_length(description) <= 5000);
alter table public.submissions
  add constraint submissions_body_len check (char_length(body) <= 20000);
alter table public.marks
  add constraint marks_comment_len check (char_length(comment) <= 1000),
  add constraint marks_student_fix_len check (char_length(student_fix) <= 1000);
alter table public.topics
  add constraint topics_name_len check (char_length(name) <= 100),
  add constraint topics_rule_len check (char_length(rule) <= 500);
alter table public.books
  add constraint books_title_len check (char_length(title) <= 200);

-- Регистрация с очень длинным именем не должна ломаться: имя обрезается.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  code text := new.raw_user_meta_data ->> 'teacher_code';
  new_role text := 'student';
begin
  if code is not null then
    if not public.teacher_code_ok(code) then
      raise exception 'Неверный код преподавателя';
    end if;
    new_role := 'teacher';
  end if;
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 100), new_role);
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Пока преподаватель проверяет работу, ученик не видит его пометок даже через API.
drop policy "marks: свои или преподаватель" on public.marks;
create policy "marks: свои после проверки или преподаватель" on public.marks
  for select to authenticated using (
    public.is_teacher()
    or exists (
      select 1 from public.submissions s
      where s.id = submission_id and s.student_id = auth.uid() and s.status <> 'submitted'
    )
  );

-- Гостям (без входа) таблицы не нужны вовсе: сейчас их закрывает RLS, теперь и права.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
