-- Закрывает служебные функции базы от прямого вызова через API.
-- Выполните этот файл целиком в Supabase: SQL Editor → New query → Run.

-- Функции триггеров вызывает только сама база. Право на вызов проверяется
-- при создании триггера, а не при срабатывании, поэтому триггеры продолжают работать.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_submission_update() from public, anon, authenticated;
revoke execute on function public.guard_mark_update() from public, anon, authenticated;
revoke execute on function public.guard_note_update() from public, anon, authenticated;

-- Эти две функции нужны правилам доступа (RLS), которые выполняются от имени
-- вошедшего пользователя, поэтому им оставлено право для authenticated.
-- Гостю (anon) они не нужны.
revoke execute on function public.is_teacher() from public, anon;
grant execute on function public.is_teacher() to authenticated;
revoke execute on function public.can_see_assignment(uuid) from public, anon;
grant execute on function public.can_see_assignment(uuid) to authenticated;

-- teacher_code_ok остаётся доступной гостю: её вызывает форма регистрации
-- преподавателя до входа. Она отвечает только «да» или «нет».
