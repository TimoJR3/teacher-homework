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

-- ---------------------------------------------------------------- создание и изменение заданий
select public.create_assignment('Эссе', '', null, array['00000000-0000-0000-0000-00000000000c']::uuid[]) as essay_id \gset
select pg_temp.expect_count('новое задание сразу только для Максима',
  format('select count(*) from public.assignment_students where assignment_id = %L', :'essay_id'), 1);
select pg_temp.expect_error('создание задания без названия',
  $q$select public.create_assignment('  ', '', null, null)$q$);
select pg_temp.expect_error('удаление задания, которое уже сдали',
  $q$delete from public.assignments where id = '10000000-0000-0000-0000-000000000001'$q$);
select pg_temp.expect_error('забрать задание у ученика, который его сдал',
  $q$select public.update_assignment('10000000-0000-0000-0000-000000000001', 'Всем', '', null,
     array['00000000-0000-0000-0000-00000000000c']::uuid[])$q$);
select public.update_assignment('10000000-0000-0000-0000-000000000002', 'Максиму и Ане', 'новое', null,
  array['00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c']::uuid[]);
select pg_temp.expect_count('после изменения выдано двоим',
  $q$select count(*) from public.assignment_students where assignment_id = '10000000-0000-0000-0000-000000000002'$q$, 2);
delete from public.assignments where title = 'Эссе';

set request.jwt.claim.sub = :'anya';
select pg_temp.expect_count('Аня теперь видит заданий', 'select count(*) from public.assignments', 2);
select pg_temp.expect_error('ученик создаёт задание через функцию',
  $q$select public.create_assignment('hack', '', null, null)$q$);
select pg_temp.expect_error('ученик меняет задание через функцию',
  $q$select public.update_assignment('10000000-0000-0000-0000-000000000001', 'hack', '', null, null)$q$);

reset role;
select pg_temp.expect_count('итог: принято с исправлением went',
  $q$select count(*) from public.submissions s join public.marks m on m.submission_id = s.id
     where s.status = 'accepted' and m.student_fix = 'went'$q$, 1);

-- ---------------------------------------------------------------- регистрация преподавателя по коду
insert into public.teacher_signup_code (code) values ('секретный-код-42');
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1', 'new-t@x.ru', '{"full_name":"Новый преподаватель","teacher_code":"секретный-код-42"}');
select pg_temp.expect_count('с верным кодом регистрируется преподаватель',
  $q$select count(*) from public.profiles where email = 'new-t@x.ru' and role = 'teacher'$q$, 1);
select pg_temp.expect_error('регистрация с неверным кодом',
  $q$insert into auth.users values ('00000000-0000-0000-0000-0000000000d2', 'fake@x.ru', '{"teacher_code":"угадал?"}')$q$);
select pg_temp.expect_count('с неверным кодом аккаунт не создан',
  $q$select count(*) from auth.users where email = 'fake@x.ru'$q$, 0);
insert into auth.users values ('00000000-0000-0000-0000-0000000000d3', 'new-s@x.ru', '{"full_name":"Новый ученик"}');
select pg_temp.expect_count('без кода регистрируется ученик',
  $q$select count(*) from public.profiles where email = 'new-s@x.ru' and role = 'student'$q$, 1);

set role authenticated;
set request.jwt.claim.sub = :'anya';
select pg_temp.expect_error('ученик читает код преподавателя',
  'select code from public.teacher_signup_code');
select pg_temp.expect_count('проверка кода отвечает только да или нет',
  $q$select count(*) from (select public.teacher_code_ok('угадал?') as ok) t where not ok$q$, 1);
reset role;

-- ---------------------------------------------------------------- блокнот ученика
set role authenticated;
set request.jwt.claim.sub = :'anya';
insert into public.notes (body) values ('Past Simple: went, saw, did');
select pg_temp.expect_count('ученик видит свою заметку',
  'select count(*) from public.notes', 1);
select pg_temp.expect_error('ученик пишет заметку от имени другого',
  $q$insert into public.notes (student_id, body) values ('00000000-0000-0000-0000-00000000000c', 'чужая')$q$);
select pg_temp.expect_error('пустая заметка',
  $q$insert into public.notes (body) values ('   ')$q$);
select pg_temp.expect_error('ученик передаёт заметку другому',
  $q$update public.notes set student_id = '00000000-0000-0000-0000-00000000000c'$q$);

set request.jwt.claim.sub = :'max';
select pg_temp.expect_count('другой ученик не видит чужие заметки',
  'select count(*) from public.notes', 0);
update public.notes set body = 'взлом';
delete from public.notes;

set request.jwt.claim.sub = :'teacher';
select pg_temp.expect_count('преподаватель не видит заметки ученика',
  'select count(*) from public.notes', 0);
select pg_temp.expect_error('преподаватель пишет в блокнот',
  $q$insert into public.notes (body) values ('x')$q$);

set request.jwt.claim.sub = :'anya';
select pg_temp.expect_count('чужие изменения и удаление не прошли',
  $q$select count(*) from public.notes where body = 'Past Simple: went, saw, did'$q$, 1);
update public.notes set body = 'Past Simple: went, saw, did, made';
delete from public.notes;
select pg_temp.expect_count('ученик меняет и удаляет свою заметку',
  'select count(*) from public.notes', 0);
reset role;

-- ---------------------------------------------------------------- служебные функции закрыты от API
set role anon;
select pg_temp.expect_error('гость вызывает is_teacher', 'select public.is_teacher()');
select pg_temp.expect_error('гость вызывает can_see_assignment',
  $q$select public.can_see_assignment('10000000-0000-0000-0000-000000000001')$q$);
select pg_temp.expect_count('гость проверяет код преподавателя',
  $q$select count(*) from (select public.teacher_code_ok('x')) t$q$, 1);
set role authenticated;
set request.jwt.claim.sub = :'anya';
select pg_temp.expect_error('ученик вызывает функцию триггера', 'select public.handle_new_user()');
select pg_temp.expect_error('ученик вызывает guard_mark_update', 'select public.guard_mark_update()');
reset role;
insert into auth.users values ('00000000-0000-0000-0000-0000000000e1', 'after-revoke@x.ru', '{"full_name":"После закрытия"}');
select pg_temp.expect_count('регистрация работает после закрытия функций',
  $q$select count(*) from public.profiles where email = 'after-revoke@x.ru' and role = 'student'$q$, 1);

-- ---------------------------------------------------------------- виды записей в блокноте
set role authenticated;
set request.jwt.claim.sub = :'anya';
insert into public.notes (body, kind) values ('apple — яблоко', 'word');
select pg_temp.expect_count('запись со словом сохраняется',
  $q$select count(*) from public.notes where kind = 'word'$q$, 1);
insert into public.notes (body) values ('просто заметка');
select pg_temp.expect_count('вид по умолчанию — заметка',
  $q$select count(*) from public.notes where body = 'просто заметка' and kind = 'note'$q$, 1);
select pg_temp.expect_error('неизвестный вид записи',
  $q$insert into public.notes (body, kind) values ('x', 'secret')$q$);
delete from public.notes;
reset role;

\echo 'Все проверки прав прошли.'
