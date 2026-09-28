-- CSR request attachments (apply in Supabase SQL editor)
-- Follows the existing csr_requests trust model: no Supabase Auth, anon key
-- read/write, identity comes from the app's own URL/member-code scheme.
-- Storage bucket is public so the client can link to files without signed URLs.

create table if not exists public.csr_request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.csr_requests (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  file_size_bytes integer not null,
  content_type text,
  uploaded_by text not null,
  created_at timestamptz not null default now(),

  constraint csr_request_attachments_file_name_not_blank
    check (length(trim(file_name)) > 0),
  constraint csr_request_attachments_storage_path_not_blank
    check (length(trim(storage_path)) > 0),
  constraint csr_request_attachments_size_valid
    check (file_size_bytes > 0 and file_size_bytes <= 10485760) -- 10MB server-side re-check
);

create index if not exists csr_request_attachments_request_id_idx
  on public.csr_request_attachments (request_id, created_at asc);

-- Server-side re-check of the "max 5 per request" rule (client also enforces this).
create or replace function public.csr_request_attachments_enforce_max()
returns trigger as $$
begin
  if (select count(*) from public.csr_request_attachments where request_id = new.request_id) >= 5 then
    raise exception 'CSR 요청당 첨부파일은 최대 5개까지 가능합니다.';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists csr_request_attachments_max_check on public.csr_request_attachments;
create trigger csr_request_attachments_max_check
  before insert on public.csr_request_attachments
  for each row execute function public.csr_request_attachments_enforce_max();

alter table public.csr_request_attachments enable row level security;

grant select, insert on table public.csr_request_attachments to anon;

drop policy if exists "csr_request_attachments_read_all" on public.csr_request_attachments;
create policy "csr_request_attachments_read_all"
  on public.csr_request_attachments for select using (true);

drop policy if exists "csr_request_attachments_insert_all" on public.csr_request_attachments;
create policy "csr_request_attachments_insert_all"
  on public.csr_request_attachments for insert with check (true);

-- Storage bucket — public (no signed URLs needed for download/open-in-new-tab).
insert into storage.buckets (id, name, public, file_size_limit)
values ('csr-attachments', 'csr-attachments', true, 10485760)
on conflict (id) do update set public = true, file_size_limit = 10485760;

drop policy if exists "csr_attachments_storage_read" on storage.objects;
create policy "csr_attachments_storage_read"
  on storage.objects for select
  using (bucket_id = 'csr-attachments');

drop policy if exists "csr_attachments_storage_insert" on storage.objects;
create policy "csr_attachments_storage_insert"
  on storage.objects for insert
  with check (bucket_id = 'csr-attachments');
