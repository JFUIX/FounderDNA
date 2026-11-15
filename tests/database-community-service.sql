begin;
select set_config('qa.owner_a',gen_random_uuid()::text,true),set_config('qa.owner_b',gen_random_uuid()::text,true),set_config('qa.reviewer',gen_random_uuid()::text,true),set_config('qa.post',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at)
select id::uuid,'authenticated','authenticated','audit-'||id||'@example.invalid',now(),now(),now() from unnest(array[current_setting('qa.owner_a'),current_setting('qa.owner_b'),current_setting('qa.reviewer')]) id;
insert into service_private.reviewer_emails(email) values('audit-'||current_setting('qa.reviewer')||'@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('qa.owner_a'),'email','audit-'||current_setting('qa.owner_a')||'@example.invalid','role','authenticated')::text,true);
with inserted as (
insert into public.milestones(user_id,business,author_name,category,headline,story,publication_consent)
values(auth.uid(),'Audit business','Audit founder','Learning','Audit milestone','A transactional audit milestone.',true) returning id
) select set_config('qa.post',(select id::text from inserted),true);
do $$begin
if not exists(select 1 from public.milestones where id=current_setting('qa.post')::uuid) then raise exception 'Owner cannot read pending milestone';end if;
begin
update public.milestones set publication_status='Approved' where id=current_setting('qa.post')::uuid;
raise exception 'Owner self-publication allowed';
exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('qa.owner_b'),'email','audit-'||current_setting('qa.owner_b')||'@example.invalid','role','authenticated')::text,true);
do $$begin
if exists(select 1 from public.milestones where id=current_setting('qa.post')::uuid) then raise exception 'Other user read private milestone';end if;
begin
insert into public.milestone_comments(post_id,user_id,author_name,body) values(current_setting('qa.post')::uuid,auth.uid(),'Audit reply','Must be denied on pending milestone');
raise exception 'Reply to pending allowed';
exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('qa.reviewer'),'email','audit-'||current_setting('qa.reviewer')||'@example.invalid','role','authenticated')::text,true);
do $$begin
if not public.service_reviewer_status() then raise exception 'Reviewer authorization failed';end if;
update public.milestones set publication_status='Approved' where id=current_setting('qa.post')::uuid;
if not found then raise exception 'Reviewer moderation failed';end if;
end$$;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$begin if not exists(select 1 from public.milestones where id=current_setting('qa.post')::uuid) then raise exception 'Anonymous approved feed failed';end if;end$$;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('qa.owner_b'),'email','audit-'||current_setting('qa.owner_b')||'@example.invalid','role','authenticated')::text,true);
insert into public.milestone_comments(post_id,user_id,author_name,body) values(current_setting('qa.post')::uuid,auth.uid(),'Audit reply','Reply to approved audit milestone');
select set_config('qa.request',(select request_id::text from public.submit_business_brief('Request Support','{"business":"Audit business","situation":"Validate the private support flow","outcome":"A useful next step","review_consent":true}','[]',gen_random_uuid())),true);
insert into public.request_updates(request_id,author_id,kind,message) values(current_setting('qa.request')::uuid,auth.uid(),'Message','Audit owner follow-up');
select set_config('request.jwt.claims',json_build_object('sub',current_setting('qa.owner_a'),'role','authenticated')::text,true);
do $$begin
if exists(select 1 from public.business_requests where id=current_setting('qa.request')::uuid) or exists(select 1 from public.request_updates where request_id=current_setting('qa.request')::uuid) then raise exception 'Private support data leaked';end if;
end$$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('qa.reviewer'),'email','audit-'||current_setting('qa.reviewer')||'@example.invalid','role','authenticated')::text,true);
do $$begin
if not exists(select 1 from public.business_requests where id=current_setting('qa.request')::uuid) then raise exception 'Reviewer cannot read support request';end if;
end$$;
with inserted as (insert into public.request_introductions(request_id,recipient,purpose,information) values(current_setting('qa.request')::uuid,'Audit partner','Review a research question','Public business summary only') returning id)
select set_config('qa.introduction',(select id::text from inserted),true);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('qa.owner_a'),'role','authenticated')::text,true);
do $$begin
update public.request_introductions set consent='Approved' where id=current_setting('qa.introduction')::uuid;
if found then raise exception 'Another account approved an introduction';end if;
end$$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('qa.owner_b'),'email','audit-'||current_setting('qa.owner_b')||'@example.invalid','role','authenticated')::text,true);
do $$begin
update public.request_introductions set consent='Approved' where id=current_setting('qa.introduction')::uuid;
if not found then raise exception 'Request owner could not give consent';end if;
update public.request_introductions set consent='Declined' where id=current_setting('qa.introduction')::uuid;
if not found then raise exception 'Request owner could not withdraw consent';end if;
end$$;
select 'PASS: introduction ownership and consent withdrawal, private milestone visibility, self-publication denial, reviewer approval, anonymous approved feed, approved replies, private brief submission and request isolation; rolled back' as result;
rollback;
