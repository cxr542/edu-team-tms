/**
 * 릴리즈노트 누락분 점검 (읽기 전용). 관리자 세션이 있어야 한다.
 *  - GET : GitHub 의 최근 머지 PR 과 배포된 릴리즈노트 문서를 읽어 누락된 PR 목록을 돌려준다.
 * 어떤 데이터도 쓰거나 바꾸지 않는다. GitHub 는 공개 저장소를 읽기만 하며,
 * GITHUB_TOKEN 환경 변수가 있으면 호출 한도를 늘리는 데에만 쓴다(없어도 동작).
 */
import { canUseAdminWrite } from './adminWriteGuard.js';
import { findMissingReleaseNotes } from '../../src/utils/releaseNoteCheck.js';

const REPO = 'cxr542/edu-team-tms';
const NOTE_PATH = '/docs/reference/TMS-릴리즈노트.md';
const FETCH_TIMEOUT_MS = 8000;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function fetchWithTimeout(url, init = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

export async function handleReleaseNoteCheck(req, res) {
  if (!canUseAdminWrite(req)) {
    return json(res, 403, { ok: false, status: 'forbidden', message: '관리자 화면에서만 점검할 수 있습니다.' });
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { ok: false, status: 'error', message: 'method not allowed' });
  }

  // referer 의 origin 은 canUseAdminWrite 가 허용 목록으로 이미 검증했다.
  const origin = new URL(String(req.headers?.referer || req.headers?.origin)).origin;

  try {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'edu-tms-release-note-check' };
    const token = String(process.env.GITHUB_TOKEN || '').trim();
    if (token) headers.Authorization = `Bearer ${token}`;

    const [prRes, noteRes] = await Promise.all([
      fetchWithTimeout(`https://api.github.com/repos/${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=100`, {
        headers,
      }),
      fetchWithTimeout(`${origin}${NOTE_PATH}`),
    ]);

    if (!prRes.ok) {
      return json(res, 502, {
        ok: false,
        status: 'upstream-error',
        message:
          prRes.status === 403 || prRes.status === 429
            ? 'GitHub 호출 한도에 걸렸습니다. 잠시 뒤 다시 시도하세요.'
            : `GitHub 응답 오류 (${prRes.status})`,
      });
    }
    if (!noteRes.ok) {
      return json(res, 502, { ok: false, status: 'upstream-error', message: `릴리즈노트 문서를 읽지 못했습니다 (${noteRes.status})` });
    }

    const [prs, noteText] = await Promise.all([prRes.json(), noteRes.text()]);
    const data = findMissingReleaseNotes({ prs, noteText });
    return json(res, 200, { ok: true, status: 'ok', data });
  } catch (error) {
    return json(res, 502, {
      ok: false,
      status: 'upstream-error',
      message: error instanceof Error ? error.message : '점검 중 오류가 발생했습니다.',
    });
  }
}
