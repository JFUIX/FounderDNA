begin;
create schema service_private;
revoke all on schema service_private from public,anon,authenticated;
grant usage on schema service_private to authenticated;
create table service_private.reviewer_emails(email text primary key check(email=lower(email)));
revoke all on service_private.reviewer_emails from public,anon,authenticated;
create function service_private.is_reviewer() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users u join service_private.reviewer_emails r on r.email=lower(u.email) where u.id=auth.uid() and u.email_confirmed_at is not null)
$$;
revoke all on function service_private.is_reviewer() from public,anon,authenticated;
grant execute on function service_private.is_reviewer() to authenticated;
create function public.service_reviewer_status() returns boolean language sql stable security invoker set search_path='' as $$select service_private.is_reviewer()$$;
revoke all on function public.service_reviewer_status() from public,anon;
grant execute on function public.service_reviewer_status() to authenticated;

create table public.founder_dna (
 user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
 brief jsonb not null check(jsonb_typeof(brief)='object' and octet_length(brief::text)<=24000),
 updated_at timestamptz not null default now()
);
alter table public.founder_dna enable row level security;
revoke all on public.founder_dna from anon,authenticated;
grant select on public.founder_dna to authenticated;
grant insert(user_id,brief),update(brief) on public.founder_dna to authenticated;
create policy "Own private DNA" on public.founder_dna for select to authenticated using((select auth.uid())=user_id);
create policy "Create private DNA" on public.founder_dna for insert to authenticated with check((select auth.uid())=user_id);
create policy "Update private DNA" on public.founder_dna for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create function service_private.stamp_dna() returns trigger language plpgsql security invoker set search_path='' as $$begin new.updated_at:=now();return new;end$$;
revoke all on function service_private.stamp_dna() from public,anon,authenticated;
create trigger stamp_dna before update on public.founder_dna for each row execute function service_private.stamp_dna();

create table public.business_requests (
 id uuid primary key default gen_random_uuid(),
 reference text not null unique default ('FD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 client_token uuid not null,
 contact_email text not null default nullif(auth.jwt()->>'email',''),
 action text not null check(action in('Request Support','Find a Collaborator','Ask an Expert','Share a Milestone','Offer Your Expertise')),
 brief jsonb not null check(jsonb_typeof(brief)='object' and octet_length(brief::text)<=24000),
 files jsonb not null default '[]' check(jsonb_typeof(files)='array' and jsonb_array_length(files)<=2),
 status text not null default 'Submitted' check(status in('Submitted','In review','Awaiting details','Next step proposed','Closed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 published_milestone_id uuid references public.milestones(id) on delete set null,
 unique(user_id,client_token)
);
create index business_requests_owner on public.business_requests(user_id,created_at desc);
create index business_requests_queue on public.business_requests(status,created_at);
create index business_requests_milestone on public.business_requests(published_milestone_id);
alter table public.business_requests enable row level security;
revoke all on public.business_requests from anon,authenticated;
grant select on public.business_requests to authenticated;
grant insert(user_id,action,brief,files,client_token),update(status) on public.business_requests to authenticated;
create policy "Read own requests or review queue" on public.business_requests for select to authenticated using((select auth.uid())=user_id or (select service_private.is_reviewer()));
create policy "Submit own requests" on public.business_requests for insert to authenticated with check((select auth.uid())=user_id and status='Submitted');
create policy "Team manages requests" on public.business_requests for update to authenticated using((select service_private.is_reviewer())) with check((select service_private.is_reviewer()));

create table public.request_updates (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.business_requests(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 kind text not null default 'Message' check(kind in('Message','Weekly check-in','Team response','Relevant opportunity','Next action')),
 message text not null check(char_length(trim(message)) between 1 and 4000),
 created_at timestamptz not null default now()
);
create index request_updates_thread on public.request_updates(request_id,created_at);
create index request_updates_author on public.request_updates(author_id);
alter table public.request_updates enable row level security;
revoke all on public.request_updates from anon,authenticated;
grant select on public.request_updates to authenticated;
grant insert(request_id,author_id,kind,message) on public.request_updates to authenticated;
create policy "Read request conversation" on public.request_updates for select to authenticated using(exists(select 1 from public.business_requests r where r.id=request_id and (r.user_id=(select auth.uid()) or (select service_private.is_reviewer()))));
create policy "Add to request conversation" on public.request_updates for insert to authenticated with check(author_id=(select auth.uid()) and exists(select 1 from public.business_requests r where r.id=request_id and (service_private.is_reviewer() or (r.user_id=(select auth.uid()) and kind in('Message','Weekly check-in')))));

create table public.request_introductions (
 id uuid primary key default gen_random_uuid(),request_id uuid not null references public.business_requests(id) on delete cascade,
 recipient text not null check(char_length(trim(recipient)) between 1 and 200),
 purpose text not null check(char_length(trim(purpose)) between 1 and 2000),
 information text not null check(char_length(trim(information)) between 1 and 3000),
 consent text not null default 'Pending' check(consent in('Pending','Approved','Declined')),
 consented_at timestamptz,created_at timestamptz not null default now()
);
create index request_introductions_request on public.request_introductions(request_id,created_at);
alter table public.request_introductions enable row level security;
revoke all on public.request_introductions from anon,authenticated;
grant select on public.request_introductions to authenticated;
grant insert(request_id,recipient,purpose,information),update(consent) on public.request_introductions to authenticated;
create policy "Read proposed introductions" on public.request_introductions for select to authenticated using(exists(select 1 from public.business_requests r where r.id=request_id and (r.user_id=(select auth.uid()) or (select service_private.is_reviewer()))));
create policy "Team proposes introductions" on public.request_introductions for insert to authenticated with check((select service_private.is_reviewer()) and consent='Pending');
create policy "Owner decides introduction" on public.request_introductions for update to authenticated using(exists(select 1 from public.business_requests r where r.id=request_id and r.user_id=(select auth.uid()))) with check(exists(select 1 from public.business_requests r where r.id=request_id and r.user_id=(select auth.uid())) and consent in('Approved','Declined'));
create function service_private.stamp_introduction_consent() returns trigger language plpgsql security invoker set search_path='' as $$begin new.consented_at:=now();return new;end$$;
revoke all on function service_private.stamp_introduction_consent() from public,anon,authenticated;
create trigger stamp_introduction_consent before update on public.request_introductions for each row execute function service_private.stamp_introduction_consent();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('founderdna-documents','founderdna-documents',false,2097152,array['application/pdf']);
create policy "Private applicant upload" on storage.objects for insert to authenticated with check(bucket_id='founderdna-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Read private applicant documents" on storage.objects for select to authenticated using(bucket_id='founderdna-documents' and ((storage.foldername(name))[1]=(select auth.uid())::text or ((select service_private.is_reviewer()) and exists(select 1 from public.business_requests r cross join lateral jsonb_array_elements(r.files) f where f->>'path'=storage.objects.name))));
create policy "Remove own unused documents" on storage.objects for delete to authenticated using(bucket_id='founderdna-documents' and (storage.foldername(name))[1]=(select auth.uid())::text and not exists(select 1 from public.business_requests r cross join lateral jsonb_array_elements(r.files) f where f->>'path'=storage.objects.name));

create function service_private.validate_request() returns trigger language plpgsql security invoker set search_path='' as $$
declare f jsonb;
begin
 if tg_op='UPDATE' then new.updated_at:=now();return new;end if;
 if new.user_id is distinct from auth.uid() then raise exception 'Please sign in again.';end if;
 if coalesce(new.brief->>'review_consent','')<>'true' then raise exception 'Permission for private team review is required.';end if;
 if char_length(trim(coalesce(new.brief->>'business',''))) not between 1 and 120 or char_length(trim(coalesce(new.brief->>'situation',''))) not between 1 and 4000 or char_length(trim(coalesce(new.brief->>'outcome',''))) not between 1 and 2000 then raise exception 'Please complete your business, situation, and desired next step.';end if;
 if new.action='Offer Your Expertise' and (char_length(trim(coalesce(new.brief->>'skills','')))=0 or char_length(trim(coalesce(new.brief->>'availability','')))=0) then raise exception 'Please include your skills and availability.';end if;
 if jsonb_array_length(new.files)>0 and (new.action<>'Offer Your Expertise' or coalesce(new.brief->>'document_consent','')<>'true') then raise exception 'Please approve sending documents for private review.';end if;
 for f in select * from jsonb_array_elements(new.files) loop
  if coalesce(f->>'kind','') not in('CV','Portfolio') or (storage.foldername(f->>'path'))[1]<>auth.uid()::text or not exists(select 1 from storage.objects o where o.bucket_id='founderdna-documents' and o.name=f->>'path') then raise exception 'An attachment could not be verified. Please upload it again.';end if;
 end loop;
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,4));
 if (select count(*) from public.business_requests where user_id=new.user_id and created_at>now()-interval '1 hour')>=5 then raise exception 'You can send up to five briefs per hour. Please try again later.';end if;
 new.created_at:=now();new.updated_at:=now();return new;
end$$;
revoke all on function service_private.validate_request() from public,anon,authenticated;
create trigger validate_request before insert or update on public.business_requests for each row execute function service_private.validate_request();
create function public.submit_business_brief(p_action text,p_brief jsonb,p_files jsonb default '[]',p_client_token uuid default gen_random_uuid()) returns table(request_id uuid,request_reference text) language plpgsql security invoker set search_path='' as $$
declare r public.business_requests;
begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_client_token::text,5));
 select * into r from public.business_requests where user_id=auth.uid() and client_token=p_client_token;
 if found then return query select r.id,r.reference;return;end if;
 insert into public.business_requests(user_id,action,brief,files,client_token) values(auth.uid(),p_action,p_brief,p_files,p_client_token) returning * into r;
 insert into public.founder_dna(user_id,brief) values(auth.uid(),p_brief-'review_consent'-'document_consent'-'public_consent') on conflict(user_id) do update set brief=excluded.brief;
 return query select r.id,r.reference;
end$$;
revoke all on function public.submit_business_brief(text,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.submit_business_brief(text,jsonb,jsonb,uuid) to authenticated;

-- Milestones require explicit opt-in and human approval. Existing content is
-- preserved and queued for review; it is not deleted or silently re-approved.
alter table public.milestones add column publication_status text not null default 'Pending' check(publication_status in('Pending','Approved','Declined'));
alter table public.milestones add column publication_consent boolean not null default false;
alter table public.milestones add constraint approved_requires_consent check(publication_status<>'Approved' or publication_consent);
drop policy "Public milestone feed" on public.milestones;
drop policy "Own milestones only" on public.milestones;
drop policy "Edit own milestones" on public.milestones;
create policy "Approved milestones or own queue" on public.milestones for select to anon,authenticated using(publication_status='Approved' or user_id=(select auth.uid()));
create policy "Review all milestones" on public.milestones for select to authenticated using((select service_private.is_reviewer()));
create policy "Submit consented milestone" on public.milestones for insert to authenticated with check(user_id=(select auth.uid()) and publication_consent and publication_status='Pending');
create policy "Edit own pending milestone" on public.milestones for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and publication_status='Pending' and publication_consent);
create policy "Moderate milestones" on public.milestones for update to authenticated using((select service_private.is_reviewer())) with check((select service_private.is_reviewer()));
grant insert(publication_consent),update(publication_consent,publication_status) on public.milestones to authenticated;
create or replace function community_private.stamp_milestone_edit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 new.updated_at:=now();
 if new.publication_consent is distinct from old.publication_consent and new.user_id is distinct from auth.uid() then raise exception 'Only the owner can give publication permission.';end if;
 if (new.business,new.category,new.headline,new.story) is distinct from (old.business,old.category,old.headline,old.story) then new.publication_status:='Pending';end if;
 return new;
end$$;
drop policy "Public conversations" on public.milestone_comments;
drop policy "Own replies only" on public.milestone_comments;
create policy "Approved milestone conversations" on public.milestone_comments for select to anon,authenticated using(exists(select 1 from public.milestones m where m.id=post_id and m.publication_status='Approved'));
create policy "Reply to approved milestones" on public.milestone_comments for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.milestones m where m.id=post_id and m.publication_status='Approved'));

-- The trusted review action may publish a request owner's consented milestone.
create or replace function community_private.check_community_rate() returns trigger language plpgsql security invoker set search_path='' as $$
declare recent_count integer;
begin
 if tg_table_name='milestones' then
  if service_private.is_reviewer() and new.publication_status='Approved' then new.created_at:=now();return new;end if;
 end if;
 if new.user_id is distinct from auth.uid() then raise exception 'Please sign in again.';end if;
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
 if tg_table_name='milestones' then select count(*) into recent_count from public.milestones where user_id=new.user_id and created_at>now()-interval '1 hour';
 if recent_count>=5 then raise exception 'Please wait before sharing another milestone.';end if;
 else select count(*) into recent_count from public.milestone_comments where user_id=new.user_id and created_at>now()-interval '1 hour';
 if recent_count>=30 then raise exception 'Please wait before posting another reply.';end if;end if;
 new.created_at:=now();return new;
end$$;

create function service_private.publish_reviewed_milestone(p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.business_requests;result uuid;
begin
 if not service_private.is_reviewer() then raise exception 'Reviewer access is required.';end if;
 select * into r from public.business_requests where id=p_request for update;
 if not found or r.action<>'Share a Milestone' or coalesce(r.brief->>'public_consent','')<>'true' then raise exception 'Explicit public milestone consent is required.';end if;
 if r.published_milestone_id is not null then return r.published_milestone_id;end if;
 if char_length(trim(coalesce(r.brief->>'milestone_title',''))) not between 1 and 120 or char_length(trim(coalesce(r.brief->>'milestone_story',''))) not between 1 and 2000 then raise exception 'Public milestone title and story are required.';end if;
 insert into public.milestones(user_id,business,author_name,category,headline,story,publication_consent,publication_status) values(r.user_id,r.brief->>'business','Business update','Learning',r.brief->>'milestone_title',r.brief->>'milestone_story',true,'Approved') returning id into result;
 update public.business_requests set published_milestone_id=result,status='Next step proposed' where id=r.id;
 return result;
end$$;
revoke all on function service_private.publish_reviewed_milestone(uuid) from public,anon,authenticated;
grant execute on function service_private.publish_reviewed_milestone(uuid) to authenticated;
create function public.publish_reviewed_milestone(p_request uuid) returns uuid language sql security invoker set search_path='' as $$select service_private.publish_reviewed_milestone(p_request)$$;
revoke all on function public.publish_reviewed_milestone(uuid) from public,anon;
grant execute on function public.publish_reviewed_milestone(uuid) to authenticated;
commit;
