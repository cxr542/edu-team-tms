import { describe, it, expect, vi, afterEach } from 'vitest';
import handler from '../api/ai-journal-summary.js';

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(k, v) { this.headers[k] = v; },
    end(b) { this.body = b; },
  };
}

const req = () => ({
  method: 'POST',
  headers: { referer: 'https://x.test/admin' },
  body: { journalText: '[2026-09-01]\n- 카테고리: 교육, 제목: 테스트' },
});

const geminiOk = () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'SUMMARY' }] } }] }) });
const geminiErr = (status) => ({ ok: false, status, text: async () => `{"error":{"code":${status}}}` });
const run = async () => {
  const res = mockRes();
  await handler(req(), res, { env: { GEMINI_API_KEY: 'k' }, sleep: async () => {} });
  return { res, json: JSON.parse(res.body) };
};

afterEach(() => vi.unstubAllGlobals());

describe('ai-journal-summary retry', () => {
  it('retries a transient 503 and succeeds', async () => {
    const f = vi.fn().mockResolvedValueOnce(geminiErr(503)).mockResolvedValueOnce(geminiOk());
    vi.stubGlobal('fetch', f);
    const { res, json } = await run();
    expect(res.statusCode).toBe(200);
    expect(json.summary).toBe('SUMMARY');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('falls back to another model when the first keeps failing', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(geminiErr(503)).mockResolvedValueOnce(geminiErr(503))
      .mockResolvedValueOnce(geminiOk());
    vi.stubGlobal('fetch', f);
    const { json } = await run();
    expect(json.ok).toBe(true);
    expect(f.mock.calls[2][0]).toContain('gemini-flash-lite-latest');
  });

  it('returns a friendly message (no raw JSON) when every model is busy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiErr(503)));
    const { res, json } = await run();
    expect(res.statusCode).toBe(503);
    expect(json.ok).toBe(false);
    expect(json.error).toBe('AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해 주세요.');
  });

  it('does not retry a non-retryable 400 on the same model', async () => {
    const f = vi.fn().mockResolvedValue(geminiErr(400));
    vi.stubGlobal('fetch', f);
    const { res } = await run();
    expect(res.statusCode).toBe(502);
    expect(f).toHaveBeenCalledTimes(3); // one per model
  });
});
