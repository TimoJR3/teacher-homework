-- Отдельная регистрация преподавателя по секретному коду.
-- Выполните этот файл целиком в Supabase: SQL Editor → New query → Run.
-- Затем задайте код одной командой (см. README, «Назначить преподавателя»).

-- Код хранится в одной строке. Политик нет, поэтому с сайта таблицу не прочитать.
create table public.teacher_signup_code (
  id boolean primary key default true check (id),
  code text not null check (length(code) >= 8)
);
alter table public.teacher_signup_code enable row level security;
revoke all on public.teacher_signup_code from anon, authenticated;

-- Проверка кода до регистрации, чтобы показать понятную ошибку.
create function public.teacher_code_ok(p_code text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.teacher_signup_code where code = p_code);
$$;
revoke all on function public.teacher_code_ok(text) from public;
grant execute on function public.teacher_code_ok(text) to anon, authenticated;

-- Новый пользователь становится преподавателем, только если при регистрации
-- передан верный код. С неверным кодом регистрация не проходит совсем,
-- чтобы человек не оказался учеником, думая, что он преподаватель.
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
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new_role);
  return new;
end;
$$;
