import { sanitizeNavSettings } from './navOrder.js';

const NAV_SETTINGS_API = '/api/nav-settings';

const result = (fields) => ({ ok: false, status: 'error', message: '', data: null, ...fields });

async function call(method, value) {
  try {
    const response = await fetch(NAV_SETTINGS_API, {
      method,
      credentials: 'include',
      headers: value ? { 'Content-Type': 'application/json' } : undefined,
      body: value ? JSON.stringify({ value }) : undefined,
    });
    const body = await response.json().catch(() => null);

    // 개발 서버처럼 API 가 없을 때는 JSON 이 아닌 화면(HTML)이 돌아온다
    if (!body || typeof body.ok !== 'boolean') {
      return result({ message: '응답 형식이 올바르지 않아요' });
    }
    if (response.status === 403) {
      return result({ status: 'forbidden', message: body.message || '관리자 세션이 필요해요. /admin 에서 다시 로그인해 주세요.' });
    }
    if (!response.ok || !body.ok) {
      return result({ status: body.status || 'error', message: body.message || `메뉴 설정 API 오류 (${response.status})` });
    }
    return result({ ok: true, status: body.status || 'ok', data: body.data ?? null });
  } catch (error) {
    return result({ message: error instanceof Error ? error.message : '메뉴 설정 API 요청에 실패했어요' });
  }
}

/** 팀 공유 메뉴 설정을 읽는다. 성공하면 data 가 {value:{order,labels}, updatedAt} 이거나(저장된 적 없으면 null). */
export async function fetchNavSettings() {
  const res = await call('GET');
  if (!res.ok || !res.data) return res;
  return { ...res, data: { ...res.data, value: sanitizeNavSettings(res.data.value) } };
}

/** 팀 공유 메뉴 설정을 통째로 저장한다 (관리자 세션 필요). */
export function saveNavSettings(value) {
  return call('PUT', sanitizeNavSettings(value));
}
