/**
 * Client helpers for PPT Academizer (TMS native page).
 * Health via same-origin proxy; preview/academize POST directly to apiBase (CORS).
 */

function decodeWarningsHeader(b64) {
  if (!b64) return null;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder('utf-8').decode(bytes));
}

export async function fetchAcademizerHealth() {
  const res = await fetch('/api/academizer?action=health', {
    method: 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok && !data) {
    const err = new Error(`아카데미화 API 오류 (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return (
    data || {
      available: false,
      configured: false,
      apiBase: '',
      message: `아카데미화 API 오류 (${res.status})`,
    }
  );
}

/**
 * @param {string} apiBase
 * @param {FormData} formData
 */
export async function postWizardPreview(apiBase, formData) {
  const base = String(apiBase || '').replace(/\/$/, '');
  if (!base) throw new Error('변환 API 주소가 없습니다.');
  const res = await fetch(`${base}/wizard/preview`, { method: 'POST', body: formData });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const detail = data?.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : detail?.message || data?.message || res.statusText || '미리보기 실패';
    const err = new Error(String(message));
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

/**
 * @param {string} apiBase
 * @param {FormData} formData
 * @returns {Promise<{ blob: Blob, filename: string, meta: object|null, slideCount: string }>}
 */
export async function postAcademize(apiBase, formData) {
  const base = String(apiBase || '').replace(/\/$/, '');
  if (!base) throw new Error('변환 API 주소가 없습니다.');
  const res = await fetch(`${base}/academize`, { method: 'POST', body: formData });
  if (!res.ok) {
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    const detail = data?.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : detail?.message || data?.message || res.statusText || '아카데미화 실패';
    const err = new Error(String(message));
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]) : 'academy-deck.pptx';
  let meta = null;
  try {
    meta = decodeWarningsHeader(res.headers.get('X-Academize-Warnings') || '');
  } catch {
    meta = null;
  }
  return {
    blob,
    filename,
    meta,
    slideCount: res.headers.get('X-Academize-Slide-Count') || '',
  };
}
