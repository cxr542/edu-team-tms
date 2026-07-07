import { describe, expect, it, vi } from 'vitest';

async function loadAuthModule(client) {
  vi.resetModules();
  vi.doMock('../src/utils/supabaseClient.js', () => ({
    isSupabaseConfigured: true,
    getSupabaseClient: () => client,
  }));
  return import('../src/utils/supabaseAuth.js');
}

describe('Supabase email authentication boundary', () => {
  it('rejects an invalid email before contacting Supabase', async () => {
    const client = { auth: { signInWithOtp: vi.fn() } };
    const mod = await loadAuthModule(client);

    await expect(mod.requestSupabaseMagicLink('not-an-email')).resolves.toMatchObject({
      ok: false,
      status: 'error',
    });
    expect(client.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('requests a magic link with a normalized email', async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    const mod = await loadAuthModule({ auth: { signInWithOtp } });

    await expect(mod.requestSupabaseMagicLink(' USER@OKESTRO.COM ')).resolves.toMatchObject({
      ok: true,
      status: 'sent',
    });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'user@okestro.com',
      options: { emailRedirectTo: undefined },
    });
  });

  it('returns the current session and logs out through Supabase Auth', async () => {
    const session = { user: { email: 'user@okestro.com' } };
    const getSession = vi.fn().mockResolvedValue({ data: { session }, error: null });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const mod = await loadAuthModule({ auth: { getSession, signOut } });

    await expect(mod.getSupabaseSession()).resolves.toMatchObject({
      ok: true,
      status: 'authenticated',
      data: session,
    });
    await expect(mod.signOutSupabase()).resolves.toMatchObject({ ok: true, status: 'anonymous' });
    expect(signOut).toHaveBeenCalledOnce();
  });
});
