begin;
alter table public.milestones add column updated_at timestamptz;
alter table public.milestones add column search_document tsvector generated always as
 (to_tsvector('english',business || ' ' || headline || ' ' || story)) stored;
create index milestones_search on public.milestones using gin(search_document);
grant update(business,category,headline,story) on public.milestones to authenticated;
create policy "Edit own milestones" on public.milestones for update to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create function community_private.stamp_milestone_edit() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.updated_at:=now(); return new; end; $$;
revoke all on function community_private.stamp_milestone_edit() from public,anon,authenticated;
create trigger stamp_milestone_edit before update on public.milestones for each row execute function community_private.stamp_milestone_edit();

create table public.business_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
 business text not null check(char_length(trim(business)) between 1 and 80),
 founder_name text not null check(char_length(trim(founder_name)) between 1 and 60),
 bio text not null default '' check(char_length(bio)<=500),
 website text not null default '' check(website='' or (website ~ '^https://[^[:space:]]+$' and char_length(website)<=300))
);
alter table public.business_profiles enable row level security;
revoke all on public.business_profiles from anon,authenticated;
grant select on public.business_profiles to anon,authenticated;
grant insert(user_id,business,founder_name,bio,website),update(business,founder_name,bio,website),delete on public.business_profiles to authenticated;
create policy "Public business profiles" on public.business_profiles for select to anon,authenticated using(true);
create policy "Create own profile" on public.business_profiles for insert to authenticated with check((select auth.uid())=user_id);
create policy "Edit own profile" on public.business_profiles for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "Delete own profile" on public.business_profiles for delete to authenticated using((select auth.uid())=user_id);

create table public.community_blocks (
 blocker_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 blocked_id uuid not null references auth.users(id) on delete cascade,
 primary key(blocker_id,blocked_id), check(blocker_id<>blocked_id)
);
create index community_blocks_target on public.community_blocks(blocked_id);
alter table public.community_blocks enable row level security;
revoke all on public.community_blocks from anon,authenticated;
grant select,delete on public.community_blocks to authenticated;
grant insert(blocker_id,blocked_id) on public.community_blocks to authenticated;
create policy "Read own blocks" on public.community_blocks for select to authenticated using((select auth.uid())=blocker_id);
create policy "Create own blocks" on public.community_blocks for insert to authenticated with check((select auth.uid())=blocker_id);
create policy "Remove own blocks" on public.community_blocks for delete to authenticated using((select auth.uid())=blocker_id);

create table public.community_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 post_id uuid references public.milestones(id) on delete cascade,
 comment_id uuid references public.milestone_comments(id) on delete cascade,
 reason text not null check(char_length(trim(reason)) between 5 and 1000),
 created_at timestamptz not null default now(),
 check(num_nonnulls(post_id,comment_id)=1)
);
create index community_reports_reporter on public.community_reports(reporter_id,created_at);
create index community_reports_post on public.community_reports(post_id);
create index community_reports_comment on public.community_reports(comment_id);
alter table public.community_reports enable row level security;
revoke all on public.community_reports from anon,authenticated;
grant select on public.community_reports to authenticated;
grant insert(reporter_id,post_id,comment_id,reason) on public.community_reports to authenticated;
create policy "Read own reports" on public.community_reports for select to authenticated using((select auth.uid())=reporter_id);
create policy "Create own reports" on public.community_reports for insert to authenticated with check((select auth.uid())=reporter_id);
create function community_private.check_report_rate() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.reporter_id is distinct from auth.uid() then raise exception 'Please sign in again.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.reporter_id::text,1));
 if (select count(*) from public.community_reports where reporter_id=new.reporter_id and created_at>now()-interval '1 hour')>=20
 then raise exception 'Please wait before sending more reports.'; end if;
 new.created_at:=now(); return new;
end; $$;
revoke all on function community_private.check_report_rate() from public,anon,authenticated;
create trigger check_report_rate before insert on public.community_reports for each row execute function community_private.check_report_rate();

create table public.community_notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete cascade,
 post_id uuid not null references public.milestones(id) on delete cascade,
 comment_id uuid not null references public.milestone_comments(id) on delete cascade,
 created_at timestamptz not null default now(), read_at timestamptz,
 unique(recipient_id,comment_id)
);
create index community_notifications_inbox on public.community_notifications(recipient_id,created_at desc);
create index community_notifications_actor on public.community_notifications(actor_id);
create index community_notifications_post on public.community_notifications(post_id);
create index community_notifications_comment on public.community_notifications(comment_id);
alter table public.community_notifications enable row level security;
revoke all on public.community_notifications from anon,authenticated;
grant select,delete on public.community_notifications to authenticated;
grant update(read_at) on public.community_notifications to authenticated;
create policy "Read own notifications" on public.community_notifications for select to authenticated using((select auth.uid())=recipient_id);
create policy "Mark own notifications read" on public.community_notifications for update to authenticated using((select auth.uid())=recipient_id) with check((select auth.uid())=recipient_id);
create policy "Delete own notifications" on public.community_notifications for delete to authenticated using((select auth.uid())=recipient_id);
-- Only the reply trigger may create notifications for other users. Keep this
-- privileged helper outside the exposed schema and check the authenticated actor.
create function community_private.notify_reply() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.user_id is distinct from auth.uid() then raise exception 'Please sign in again.'; end if;
 insert into public.community_notifications(recipient_id,actor_id,post_id,comment_id)
 select distinct recipient,new.user_id,new.post_id,new.id from (
  select user_id as recipient from public.milestones where id=new.post_id
  union select user_id from public.milestone_comments where post_id=new.post_id
 ) as recipients
 where recipient<>new.user_id and not exists(
  select 1 from public.community_blocks b where
  (b.blocker_id=recipient and b.blocked_id=new.user_id) or
  (b.blocker_id=new.user_id and b.blocked_id=recipient)
 ) on conflict do nothing;
 return new;
end; $$;
revoke all on function community_private.notify_reply() from public,anon,authenticated;
create trigger notify_reply after insert on public.milestone_comments for each row execute function community_private.notify_reply();
commit;
