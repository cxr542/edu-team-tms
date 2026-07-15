-- Announcement reactions + comments (apply in Supabase SQL editor)
-- Writes go through TMS /api/* + service_role; anon has no direct insert.

create table if not exists public.announcement_reactions (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  member_code text not null,
  emoji text not null,
  created_at timestamptz not null default now(),

  constraint announcement_reactions_member_code_check
    check (member_code in ('A', 'B', 'C')),
  constraint announcement_reactions_emoji_not_blank
    check (length(trim(emoji)) > 0),
  constraint announcement_reactions_unique_member_emoji
    unique (announcement_id, member_code, emoji)
);

create index if not exists announcement_reactions_announcement_id_idx
  on public.announcement_reactions (announcement_id);

create table if not exists public.announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  member_code text not null,
  author text not null,
  body text not null,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint announcement_comments_member_code_check
    check (member_code in ('A', 'B', 'C')),
  constraint announcement_comments_author_not_blank
    check (length(trim(author)) > 0),
  constraint announcement_comments_body_not_blank
    check (length(trim(body)) > 0 and length(trim(body)) <= 500)
);

create index if not exists announcement_comments_announcement_id_created_at_idx
  on public.announcement_comments (announcement_id, created_at asc);

alter table public.announcement_reactions enable row level security;
alter table public.announcement_comments enable row level security;

revoke all on table public.announcement_reactions from anon, authenticated;
revoke all on table public.announcement_comments from anon, authenticated;

grant select on table public.announcement_reactions to anon, authenticated;
grant select on table public.announcement_comments to anon, authenticated;

grant select, insert, update, delete on table public.announcement_reactions to service_role;
grant select, insert, update, delete on table public.announcement_comments to service_role;

drop policy if exists "announcement_reactions_read_all" on public.announcement_reactions;
create policy "announcement_reactions_read_all"
  on public.announcement_reactions for select
  to anon, authenticated
  using (true);

drop policy if exists "announcement_comments_read_active" on public.announcement_comments;
create policy "announcement_comments_read_active"
  on public.announcement_comments for select
  to anon, authenticated
  using (is_deleted = false);
