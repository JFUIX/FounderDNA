-- Run once in the Supabase SQL Editor for your project.
-- Public reads; verified, signed-in users can create and delete their own content.
begin;
create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  business text not null check (char_length(trim(business)) between 1 and 80),
  author_name text not null check (char_length(trim(author_name)) between 1 and 60),
  category text not null check (category in ('Launch','Customers','Product','Team','Funding','Learning')),
  headline text not null check (char_length(trim(headline)) between 1 and 120),
  story text not null check (char_length(trim(story)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create table public.milestone_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.milestones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  author_name text not null check (char_length(trim(author_name)) between 1 and 60),
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index milestones_feed on public.milestones(created_at desc, id desc);
create index milestones_author on public.milestones(user_id, created_at desc);
create index milestone_comments_thread on public.milestone_comments(post_id, created_at);
create index milestone_comments_author on public.milestone_comments(user_id, created_at desc);
alter table public.milestones enable row level security;
alter table public.milestone_comments enable row level security;
revoke all on public.milestones, public.milestone_comments from anon, authenticated;
grant select on public.milestones, public.milestone_comments to anon, authenticated;
grant insert (user_id,business,author_name,category,headline,story) on public.milestones to authenticated;
grant insert (post_id,user_id,author_name,body) on public.milestone_comments to authenticated;
grant delete on public.milestones, public.milestone_comments to authenticated;
create policy "Public milestone feed" on public.milestones for select to anon, authenticated using (true);
create policy "Own milestones only" on public.milestones for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Delete own milestones" on public.milestones for delete to authenticated using ((select auth.uid()) = user_id);
create policy "Public conversations" on public.milestone_comments for select to anon, authenticated using (true);
create policy "Own replies only" on public.milestone_comments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Delete own replies" on public.milestone_comments for delete to authenticated using ((select auth.uid()) = user_id);
-- Limit rapid repeat submissions and derive timestamps on the server.
create function public.check_community_rate() returns trigger language plpgsql security definer set search_path = '' as $$
declare recent_count integer;
begin
  if new.user_id is distinct from auth.uid() then raise exception 'Please sign in again.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if tg_table_name = 'milestones' then
    select count(*) into recent_count from public.milestones where user_id = new.user_id and created_at > now() - interval '1 hour';
    if recent_count >= 5 then raise exception 'You can share up to 5 milestones per hour. Please try again later.'; end if;
  else
    select count(*) into recent_count from public.milestone_comments where user_id = new.user_id and created_at > now() - interval '1 hour';
    if recent_count >= 30 then raise exception 'You can post up to 30 replies per hour. Please try again later.'; end if;
  end if;
  new.created_at := now();
  return new;
end;
$$;
revoke all on function public.check_community_rate() from public, anon, authenticated;
create trigger check_milestone_rate before insert on public.milestones for each row execute function public.check_community_rate();
create trigger check_comment_rate before insert on public.milestone_comments for each row execute function public.check_community_rate();
commit;
