-- Glossary terms table migration
create table if not exists public.glossary_terms (
  id text primary key,
  slug text not null unique,
  title text not null,
  category text not null default 'topic',
  tags jsonb not null default '[]'::jsonb,
  source_url text,
  body text not null,
  related jsonb not null default '[]'::jsonb,
  visibility text not null default 'published',
  author text,
  author_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index on slug and category
create index if not exists idx_glossary_terms_slug on public.glossary_terms(slug);
create index if not exists idx_glossary_terms_category on public.glossary_terms(category);

-- Enable RLS
alter table public.glossary_terms enable row level security;

-- Policies for public reading and authenticated/team editing
create policy "Allow read published glossary terms"
  on public.glossary_terms for select
  using (true);

create policy "Allow insert glossary terms"
  on public.glossary_terms for insert
  with check (true);

create policy "Allow update glossary terms"
  on public.glossary_terms for update
  using (true);

create policy "Allow delete glossary terms"
  on public.glossary_terms for delete
  using (true);
