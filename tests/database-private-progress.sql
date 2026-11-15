begin;
select set_config('qa.owner_a',gen_random_uuid()::text,true),set_config('qa.owner_b',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,created_at,updated_at) values
(current_setting('qa.owner_a')::uuid,'authenticated','authenticated','audit-a-'||current_setting('qa.owner_a')||'@example.invalid',now(),now()),
(current_setting('qa.owner_b')::uuid,'authenticated','authenticated','audit-b-'||current_setting('qa.owner_b')||'@example.invalid',now(),now());
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('qa.owner_a'),'role','authenticated')::text,true);
insert into public.assessment_results(user_id,overall_score,dimension_scores,answers) values(auth.uid(),50,'{"clarity":50,"validation":50,"execution":50,"resilience":50}','[2,2,2,2,2,2,2,2,2,2,2,2]');
insert into public.founder_action_tasks(user_id,title) values(auth.uid(),'Transactional audit task');
insert into public.founder_weekly_checkins(user_id,week_start,win) values(auth.uid(),date_trunc('week',now())::date,'Transactional audit reflection');
do $$begin
if (select count(*) from public.assessment_results)<>1 or (select count(*) from public.founder_action_tasks)<>1 or (select count(*) from public.founder_weekly_checkins)<>1 then raise exception 'Owner reads failed'; end if;
update public.founder_action_tasks set completed=true where user_id=auth.uid();
if not found then raise exception 'Owner task update failed';end if;
update public.founder_weekly_checkins set win='Updated audit reflection' where user_id=auth.uid();
if not found then raise exception 'Owner reflection update failed';end if;
end$$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('qa.owner_b'),'role','authenticated')::text,true);
do $$begin
if exists(select 1 from public.assessment_results) or exists(select 1 from public.founder_action_tasks) or exists(select 1 from public.founder_weekly_checkins) then raise exception 'Cross-account read leaked';end if;
update public.founder_action_tasks set completed=false where user_id=current_setting('qa.owner_a')::uuid;
if found then raise exception 'Cross-account update allowed';end if;
delete from public.assessment_results where user_id=current_setting('qa.owner_a')::uuid;
if found then raise exception 'Cross-account delete allowed';end if;
begin
insert into public.founder_action_tasks(user_id,title) values(current_setting('qa.owner_a')::uuid,'Spoofed owner');
raise exception 'Spoofed ownership allowed';
exception when insufficient_privilege then null;
end;
end$$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('qa.owner_a'),'role','authenticated')::text,true);
do $$begin
delete from public.assessment_results where user_id=auth.uid();if not found then raise exception 'Owner assessment delete failed';end if;
delete from public.founder_action_tasks where user_id=auth.uid();if not found then raise exception 'Owner task delete failed';end if;
delete from public.founder_weekly_checkins where user_id=auth.uid();if not found then raise exception 'Owner reflection delete failed';end if;
end$$;
select 'PASS: owner CRUD, cross-account denial, and spoofed ownership denial; all test users and data rolled back' as result;
rollback;
