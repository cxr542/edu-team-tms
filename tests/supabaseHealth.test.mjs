import { describe, expect, it, vi } from 'vitest';

describe('supabase health check', () => {
  it('returns disabled when Supabase env vars are not configured', async () => {
    vi.resetModules();

    const mod = await import('../src/utils/supabaseHealth.js');
    const result = await mod.checkSupabaseHealth();

    expect(result.status).toBe(mod.SUPABASE_HEALTH_STATUS.DISABLED);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('environment variables');
  });
});
