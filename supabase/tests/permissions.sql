-- Проверка прав доступа. Запускается после auth_stub.sql и всех миграций:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/permissions.sql
-- Любое неожиданное поведение останавливает скрипт с ошибкой.

\set ON_ERROR_STOP 1
\set teacher '00000000-0000-0000-0000-00000000000a'
\set anya '00000000-0000-0000-0000-00000000000b'
\set max '00000000-0000-0000-0000-00000000000c'

-- Выполняет запрос и падает, если он НЕ завершился ошибкой.
create function pg_temp.expect_error(label text, q text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    raise notice 'ok (запрещено): %', label;
    return;
  end;
  raise exception 'ОЖИДАЛАСЬ ОШИБКА, но запрос прошёл: %', label;
end;
$$;

-- Проверяет, что запрос возвращает ожидаемое число.
create function pg_temp.expect_count(label text, q text, expected bigint) returns void language plpgsql as $$
declare
  got bigint;
begin
  execute q into got;
  if got is distinct from expected then
    raise exception 'НЕВЕРНО: % — ожидалось %, получено %', label, expected, got;
  end if;
  raise notice 'ok: % = %', label, got;
end;
$$;

insert into auth.users values
  (:'teacher', 't@x.ru', '{"full_name":"Преподаватель"}'),
  (:'anya', 'a@x.ru', '{"full_name":"Аня"}'),
  (:'max', 'm@x.ru', '{"full_name":"Максим"}');
update public.profiles set role = 'teacher' where id = :'teacher';

-- ---------------------------------------------------------------- ученик
set role authenticated;
set request.jwt.claim.sub = :'anya';
select pg_temp.expect_error('ученик меняет себе роль',
  $q$update public.profiles set role = 'teacher' where id = auth.uid()$q$);
select pg_temp.expect_error('ученик создаёт задание',
  $q$insert into public.assignments (title) values ('hack')$q$);
select pg_temp.expect_count('ученик видит профилей', 'select count(*) from public.profiles', 1);

-- ---------------------------------------------------------------- преподаватель создаёт задания
set request.jwt.claim.sub = :'teacher';
insert into public.assignments (id, title) values
  ('10000000-0000-0000-0000-000000000001', 'Всем'),
  ('10000000-0000-0000-0000-000000000002', 'Только Максиму');
insert into public.assignment_students values ('10000000-0000-0000-0000-000000000002', :'max');
select pg_temp.expect_error('преподаватель сдаёт работу',
  $q$insert into public.submissions (assignment_id, body) values ('10000000-0000-0000-0000-000000000001', 'x')$q$);
select pg_temp.expect_count('преподаватель видит профилей', 'select count(*) from public.profiles', 3);

-- ---------------------------------------------------------------- выдача конкретным ученикам
set request.jwt.claim.sub = :'anya';
select pg_temp.expect_count('Аня видит заданий', 'select count(*) from public.assignments', 1);
select pg_temp.expect_count('Аня видит строк выдачи', 'select count(*) from public.assignment_students', 0);
select pg_temp.expect_error('Аня сдаёт чужое задание',
  $q$insert into public.submissions (assignment_id, body) values ('10000000-0000-0000-0000-000000000002', 'x')$q$);
set request.jwt.claim.sub = :'max';
select pg_temp.expect_count('Максим видит заданий', 'select count(*) from public.assignments', 2);
select pg_temp.expect_error('Максим выдаёт себе задание',
  $q$insert into public.assignment_students values ('10000000-0000-0000-0000-000000000001', auth.uid())$q$);

-- ---------------------------------------------------------------- ученик сдаёт
set request.jwt.claim.sub = :'anya';
insert into public.submissions (id, assignment_id, body)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'I have been to Spain');
select pg_temp.expect_error('ученик сдаёт сразу принятой',
  $q$insert into public.submissions (assignment_id, body, status) values ('10000000-0000-0000-0000-000000000001', 'y', 'accepted')$q$);
select pg_temp.expect_error('ученик сам принимает работу',
  $q$update public.submissions set status = 'accepted' where id = '20000000-0000-0000-0000-000000000001'$q$);
select pg_temp.expect_error('ученик ставит пометку',
  $q$insert into public.marks (submission_id, start_offset, end_offset, quote, topic_id)
     select '20000000-0000-0000-0000-000000000001', 2, 11, 'have been', id from public.topics limit 1$q$);

set request.jwt.claim.sub = :'max';
select pg_temp.expect_count('Максим видит чужих работ', 'select count(*) from public.submissions', 0);

-- ---------------------------------------------------------------- преподаватель проверяет
set request.jwt.claim.sub = :'teacher';
insert into public.marks (id, submission_id, start_offset, end_offset, quote, topic_id, comment)
  select '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 2, 11, 'have been', id, 'Past Simple'
  from public.topics where name like 'Времена%';
select pg_temp.expect_error('преподаватель меняет текст ученика',
  $q$update public.submissions set body = 'changed' where id = '20000000-0000-0000-0000-000000000001'$q$);
select pg_temp.expect_error('преподаватель пишет исправление за ученика',
  $q$update public.marks set student_fix = 'went' where id = '30000000-0000-0000-0000-000000000001'$q$);
update public.submissions set status = 'returned' where id = '20000000-0000-0000-0000-000000000001';
select pg_temp.expect_error('пометка к работе на исправлении',
  $q$insert into public.marks (submission_id, start_offset, end_offset, quote, topic_id)
     select '20000000-0000-0000-0000-000000000001', 15, 20, 'Spain', id from public.topics limit 1$q$);
select pg_temp.expect_error('удаление темы, которая используется',
  $q$delete from public.topics where name like 'Времена%'$q$);

-- ---------------------------------------------------------------- ученик исправляет
set request.jwt.claim.sub = :'anya';
select pg_temp.expect_error('ученик меняет комментарий',
  $q$update public.marks set comment = 'nope' where id = '30000000-0000-0000-0000-000000000001'$q$);
update public.marks set student_fix = 'went' where id = '30000000-0000-0000-0000-000000000001';
select pg_temp.expect_error('ученик меняет текст при отправке',
  $q$update public.submissions set status = 'fixed', body = 'other' where id = '20000000-0000-0000-0000-000000000001'$q$);
update public.submissions set status = 'fixed' where id = '20000000-0000-0000-0000-000000000001';
select pg_temp.expect_error('ученик меняет исправление после отправки',
  $q$update public.marks set student_fix = 'gone' where id = '30000000-0000-0000-0000-000000000001'$q$);

set request.jwt.claim.sub = :'max';
update public.marks set student_fix = 'evil' where id = '30000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------- преподаватель принимает
set request.jwt.claim.sub = :'teacher';
update public.submissions set status = 'accepted' where id = '20000000-0000-0000-0000-000000000001';
select pg_temp.expect_error('принятую работу снова возвращают',
  $q$update public.submissions set status = 'returned' where id = '20000000-0000-0000-0000-000000000001'$q$);

reset role;
select pg_temp.expect_count('итог: принято с исправлением went',
  $q$select count(*) from public.submissions s join public.marks m on m.submission_id = s.id
     where s.status = 'accepted' and m.student_fix = 'went'$q$, 1);

\echo 'Все проверки прав прошли.'
