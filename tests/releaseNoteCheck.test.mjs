import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminSessionCookie } from '../server/api-utils/adminSession.js';
import { handleReleaseNoteCheck } from '../server/api-utils/releaseNoteCheck.js';
import { extractNotedPrNumbers, findMissingReleaseNotes } from '../src/utils/releaseNoteCheck.js';
import { summarizeReleaseNoteCheck } from '../src/utils/releaseNoteCheckApi.js';

const NOW = new Date('2026-11-26T00:00:00Z');
const pr = (number, extra = {}) => ({
  number,
  title: `feat: change ${number}`,
  merged_at: '2026-11-20T00:00:00Z',
  html_url: `https://github.com/x/y/pull/${number}`,
  user: { login: 'someone' },
  ...extra,
});

describe('release note check logic', () => {
  it('reads PR numbers from the note', () => {
    expect([...extractNotedPrNumbers('- PR #12: u\n- PR#34 x\n#99')].sort()).toEqual([12, 34]);
  });

  it('finds merged PRs missing from the note, ignoring what the workflow skips', () => {
    const prs = [
      pr(1),
      pr(2),
      pr(3, { title: 'docs(release): append PR #2' }),
      pr(4, { user: { login: 'github-actions[bot]' } }),
      pr(5, { merged_at: null }),
      pr(6, { merged_at: '2026-09-01T00:00:00Z' }),
    ];
    const out = findMissingReleaseNotes({ prs, noteText: '- PR #1: url', now: NOW });
    expect(out.missing.map((m) => m.number)).toEqual([2]);
    expect(out.checkedCount).toBe(2);
  });

  it('summarizes zero and non-zero results', () => {
    expect(summarizeReleaseNoteCheck({ days: 30, checkedCount: 7, missing: [] }).label).toBe('누락 0건');
    const s = summarizeReleaseNoteCheck({ days: 30, checkedCount: 7, missing: [{ number: 9, title: 't' }] });
    expect(s.label).toBe('누락 1건');
    expect(s.lines).toEqual(['#9 t']);
  });
});

const ORIGIN = 'https://edu-team-tms-ten.vercel.app';
const adminHeaders = () => ({ referer: `${ORIGIN}/admin`, cookie: createAdminSessionCookie().split(';')[0] });
function createRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    end(body) {
      this.body = body ? JSON.parse(body) : null;
    },
  };
}

describe('release note check API', () => {
  beforeEach(() => {
    process.env.TMS_ADMIN_GATE_PASSWORD = 'secret-gate';
    process.env.TMS_ADMIN_SESSION_SECRET = 'session-secret';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('rejects callers without an admin session and never calls upstream', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    for (const headers of [{}, { referer: `${ORIGIN}/admin` }, { referer: `${ORIGIN}/wschoi`, cookie: adminHeaders().cookie }]) {
      const res = createRes();
      await handleReleaseNoteCheck({ method: 'GET', headers }, res);
      expect(res.statusCode).toBe(403);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('only allows GET', async () => {
    const res = createRes();
    await handleReleaseNoteCheck({ method: 'POST', headers: adminHeaders() }, res);
    expect(res.statusCode).toBe(405);
  });

  it('returns missing PRs using only GET requests', async () => {
    const recent = new Date().toISOString();
    const fetchMock = vi.fn(async (url) => {
      if (String(url).startsWith('https://api.github.com/')) {
        return { ok: true, json: async () => [pr(10, { merged_at: recent }), pr(11, { merged_at: recent })] };
      }
      return { ok: true, text: async () => '- PR #10: u' };
    });
    vi.stubGlobal('fetch', fetchMock);
    const res = createRes();
    await handleReleaseNoteCheck({ method: 'GET', headers: adminHeaders() }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.missing.map((m) => m.number)).toEqual([11]);
    fetchMock.mock.calls.forEach(([, init]) => expect(init?.method ?? 'GET').toBe('GET'));
    expect(String(fetchMock.mock.calls[1][0])).toBe(`${ORIGIN}/docs/reference/TMS-릴리즈노트.md`);
  });

  it('reports a GitHub rate limit as a 502 with a readable message', async () => {
    vi.stubGlobal('fetch', async (url) =>
      String(url).startsWith('https://api.github.com/') ? { ok: false, status: 403 } : { ok: true, text: async () => '' },
    );
    const res = createRes();
    await handleReleaseNoteCheck({ method: 'GET', headers: adminHeaders() }, res);
    expect(res.statusCode).toBe(502);
    expect(res.body.message).toContain('한도');
  });
});
