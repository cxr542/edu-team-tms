-- Admin login hint — DRAFT, NOT APPLIED. Needs approval before running in production.
-- Allows the leader-editable password hint to live in public.ledger_settings under key 'admin_gate_hint'
-- (value: {"hint": "..."}). Existing rows/policies are untouched; safe to re-run.
-- The hint is publicly readable (anon SELECT) because it is shown on the login screen.

alter table public.ledger_settings drop constraint if exists ledger_settings_key_known;
alter table public.ledger_settings
  add constraint ledger_settings_key_known check (key in ('viewer_menu_visibility', 'admin_gate_hint'));

-- ROLLBACK:
-- delete from public.ledger_settings where key = 'admin_gate_hint';
-- alter table public.ledger_settings drop constraint ledger_settings_key_known;
-- alter table public.ledger_settings add constraint ledger_settings_key_known check (key in ('viewer_menu_visibility'));
