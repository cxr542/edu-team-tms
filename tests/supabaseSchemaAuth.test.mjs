import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(path.join(process.cwd(), 'supabase/schema.sql'), 'utf8');

describe('Supabase Auth RLS schema', () => {
  it('maps authenticated users to constrained team profiles', () => {
    expect(schema).toContain('create table if not exists public.tms_profiles');
    expect(schema).toContain("check (role in ('member', 'admin'))");
    expect(schema).toContain("member_code is null or member_code in ('A', 'B', 'C')");
  });

  it('limits journal writes to the matching member or an admin', () => {
    expect(schema).toContain('journal_snapshots_insert_own_or_admin');
    expect(schema).toContain('journal_snapshots_update_own_or_admin');
    expect(schema).toContain('public.is_tms_admin() or public.is_tms_member(member_code)');
    expect(schema).not.toContain('journal_snapshots_read_all_draft"\n  on public.journal_snapshots\n  for select\n  using (true)');
  });

  it('limits KPI operational writes to administrators without granting delete access', () => {
    expect(schema).toContain('kpi_operational_snapshots_insert_admin');
    expect(schema).toContain('kpi_operational_snapshots_update_admin');
    expect(schema).not.toContain('kpi_operational_snapshots_write_admin');
    expect(schema).not.toContain('on public.kpi_operational_snapshots for delete');
  });
});
