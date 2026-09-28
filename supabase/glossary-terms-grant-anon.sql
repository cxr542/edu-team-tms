-- Fix: anon role has RLS policies on glossary_terms but was never actually
-- GRANTed table privileges, so every anon-key request (the entire client
-- app) was silently failing with "permission denied" (401) and falling
-- back to local/seed data. This mirrors the existing csr_requests grant.
grant select, insert, update, delete on table public.glossary_terms to anon;
