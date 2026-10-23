import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let configured = true;
vi.mock('../src/utils/supabaseClient.js', () => ({
  get isSupabaseConfigured() {
    return configured;
  },
  getSupabaseClient: () => (configured ? {} : null),
}));

const { upsertGlossaryTermToSupabase, upsertGlossaryTermsToSupabase, deleteGlossaryTermFromSupabase } = await import(
  '../src/utils/glossarySupabase.js'
);
const { describeGlossarySaveFailure } = await import('../src/hooks/useGlossary.js');

const term = { id: 'a', slug: 'a', title: 'A', category: 'topic', tags: [], body: 'b', related: [] };
const jsonRes = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('glossary writes go through the admin API', () => {
  beforeEach(() => {
    configured = true;
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('PUTs the term with the session cookie and returns the normalized saved term', async () => {
    fetch.mockResolvedValue(jsonRes(200, { ok: true, data: [{ id: 'a', slug: 'a', title: 'A!', markdown: 'b', tags: [], related_terms: [] }] }));
    const res = await upsertGlossaryTermToSupabase(term);
    expect(fetch).toHaveBeenCalledWith('/api/glossary-admin', expect.objectContaining({ method: 'PUT', credentials: 'same-origin' }));
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ term });
    expect(res).toMatchObject({ ok: true, status: 'ok', data: { slug: 'a', title: 'A!' } });
  });

  it('turns a 403 into a clear "log in again" message and never reports success', async () => {
    fetch.mockResolvedValue(jsonRes(403, { ok: false, status: 'forbidden' }));
    const res = await upsertGlossaryTermToSupabase(term);
    expect(res).toMatchObject({ ok: false, status: 'forbidden' });
    expect(res.message).toContain('/admin');
    expect(describeGlossarySaveFailure(res)).toContain('서버에 저장하지 못했습니다');
  });

  it('validates locally before calling the API, and reports network failures', async () => {
    const bad = await upsertGlossaryTermToSupabase({ ...term, title: '' });
    expect(bad).toMatchObject({ ok: false, status: 'error' });
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRejectedValue(new Error('offline'));
    const net = await upsertGlossaryTermToSupabase(term);
    expect(net).toMatchObject({ ok: false, status: 'error', message: 'offline' });
  });

  it('deletes by slug (URL-encoded) and saves batches', async () => {
    fetch.mockResolvedValue(jsonRes(200, { ok: true, data: { slug: 'x y' } }));
    const del = await deleteGlossaryTermFromSupabase('x y');
    expect(fetch).toHaveBeenCalledWith('/api/glossary-admin?slug=x%20y', expect.objectContaining({ method: 'DELETE' }));
    expect(del).toMatchObject({ ok: true, data: { slug: 'x y' } });
    fetch.mockResolvedValue(jsonRes(200, { ok: true, data: [{ id: 'a', slug: 'a', title: 'A', markdown: '', tags: [], related_terms: [] }] }));
    const batch = await upsertGlossaryTermsToSupabase([term]);
    expect(JSON.parse(fetch.mock.calls.at(-1)[1].body)).toEqual({ terms: [term] });
    expect(batch.data).toHaveLength(1);
  });

  it('does nothing when Supabase is not configured (local-only dev)', async () => {
    configured = false;
    for (const call of [
      () => upsertGlossaryTermToSupabase(term),
      () => upsertGlossaryTermsToSupabase([term]),
      () => deleteGlossaryTermFromSupabase('a'),
    ]) {
      expect(await call()).toMatchObject({ ok: false, status: 'disabled' });
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(describeGlossarySaveFailure({ ok: false, status: 'disabled' })).toBeNull();
  });
});

describe('describeGlossarySaveFailure', () => {
  it('is silent for success, disabled and empty, and explains real failures', () => {
    expect(describeGlossarySaveFailure({ ok: true })).toBeNull();
    expect(describeGlossarySaveFailure(null)).toBeNull();
    expect(describeGlossarySaveFailure({ ok: true, status: 'empty' })).toBeNull();
    expect(describeGlossarySaveFailure({ ok: false, status: 'error', message: 'HTTP 500' })).toContain('HTTP 500');
  });
});
