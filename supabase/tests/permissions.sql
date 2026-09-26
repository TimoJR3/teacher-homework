-- Сценарий проверки прав: каждая строка после "EXPECT ERROR" должна завершиться ошибкой.
-- Запуск: см. README, раздел «Проверка прав в базе».
\set ON_ERROR_STOP 0
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','t@x.ru','{"full_name":"Teacher"}'),
 ('00000000-0000-0000-0000-00000000000b','s@x.ru','{"full_name":"Аня"}'),
 ('00000000-0000-0000-0000-00000000000c','e@x.ru','{"full_name":"Другой"}');
update public.profiles set role='teacher' where email='t@x.ru';
select email, role, full_name from profiles order by email;

-- student tries to become teacher
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000b';
\echo EXPECT ERROR: role change
update profiles set role='teacher' where id=auth.uid();
\echo EXPECT ERROR: student creates assignment
insert into assignments(title) values ('hack');

-- teacher creates assignment
reset role; set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000a';
insert into assignments(id,title) values ('10000000-0000-0000-0000-000000000001','Essay');
\echo EXPECT ERROR: teacher submits work
insert into submissions(assignment_id, body) values ('10000000-0000-0000-0000-000000000001','x');

-- student submits
set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000b';
insert into submissions(id,assignment_id, body) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','I have been to Spain');
\echo EXPECT ERROR: student submits as accepted
insert into submissions(assignment_id, body, status) values ('10000000-0000-0000-0000-000000000001','y','accepted');
\echo EXPECT ERROR: student accepts own work
update submissions set status='accepted' where id='20000000-0000-0000-0000-000000000001';
\echo EXPECT ERROR: student adds mark
insert into marks(submission_id,start_offset,end_offset,quote,topic_id) select '20000000-0000-0000-0000-000000000001',2,11,'have been',id from topics limit 1;

-- other student cannot see
set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000c';
\echo EXPECT 0 / 1 (other student sees no submissions, only own profile)
select count(*) from submissions; select count(*) from profiles;

-- teacher marks and returns
set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000a';
select count(*) as teacher_sees_profiles from profiles;
insert into marks(id,submission_id,start_offset,end_offset,quote,topic_id,comment) select '30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',2,11,'have been',id,'Past Simple' from topics where name like 'Времена%';
\echo EXPECT ERROR: teacher edits text
update submissions set body='changed' where id='20000000-0000-0000-0000-000000000001';
\echo EXPECT ERROR: teacher writes student fix
update marks set student_fix='went' where id='30000000-0000-0000-0000-000000000001';
update submissions set status='returned' where id='20000000-0000-0000-0000-000000000001';
\echo EXPECT ERROR: teacher adds mark to returned work
insert into marks(submission_id,start_offset,end_offset,quote,topic_id) select '20000000-0000-0000-0000-000000000001',15,20,'Spain',id from topics limit 1;

-- student fixes
set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000b';
\echo EXPECT ERROR: student changes comment
update marks set comment='nope' where id='30000000-0000-0000-0000-000000000001';
update marks set student_fix='went' where id='30000000-0000-0000-0000-000000000001';
\echo EXPECT ERROR: student edits body while returning
update submissions set status='fixed', body='other' where id='20000000-0000-0000-0000-000000000001';
update submissions set status='fixed' where id='20000000-0000-0000-0000-000000000001';
\echo EXPECT ERROR: student edits fix after sending
update marks set student_fix='gone' where id='30000000-0000-0000-0000-000000000001';

-- other student cannot touch
set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000c';
update marks set student_fix='evil' where id='30000000-0000-0000-0000-000000000001';

-- teacher accepts
set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000a';
update submissions set status='accepted' where id='20000000-0000-0000-0000-000000000001';
\echo EXPECT ERROR: teacher reopens accepted
update submissions set status='returned' where id='20000000-0000-0000-0000-000000000001';
reset role;
select s.status, m.quote, m.student_fix, m.comment from submissions s join marks m on m.submission_id=s.id;
