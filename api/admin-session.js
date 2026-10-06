import { createAdminSessionCookie, verifyAdminPassword } from '../server/api-utils/adminSession.js';
import { isAllowedPublishOrigin } from '../server/api-utils/publishOrigin.js';
import { checkLoginAllowed, recordLoginResult } from '../server/api-utils/adminLoginThrottle.js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'method not allowed' });
  }

  const referer = req.headers.referer || req.headers.origin || '';
  if (!isAllowedPublishOrigin(referer)) {
    return json(res, 403, { error: 'forbidden', message: '허용되지 않은 요청 출처입니다.' });
  }

  const gate = await checkLoginAllowed(req);
  if (gate.blocked) {
    res.setHeader('Retry-After', String(gate.retryAfterSec));
    return json(res, 429, {
      ok: false,
      error: 'too-many-attempts',
      message: `로그인 시도가 너무 많습니다. ${Math.ceil(gate.retryAfterSec / 60)}분 뒤 다시 시도하세요.`,
    });
  }

  const password = req.body?.password;
  if (!verifyAdminPassword(password)) {
    await recordLoginResult(req, false);
    return json(res, 401, { ok: false, message: '비밀번호가 올바르지 않습니다.' });
  }
  await recordLoginResult(req, true);

  const cookie = createAdminSessionCookie();
  if (!cookie) {
    return json(res, 501, {
      ok: false,
      message: '서버 관리자 세션 환경 변수가 설정되지 않았습니다.',
    });
  }

  res.setHeader('Set-Cookie', cookie);
  return json(res, 200, { ok: true });
}
