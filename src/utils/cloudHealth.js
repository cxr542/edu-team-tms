/** 클라우드 snapshot API 상태 — localStorage + in-memory (Blob quota 보호) */

export const CLOUD_HEALTH_STORAGE_KEY = 'tms-cloud-health-v1';
export const CLOUD_WRITE_COOLDOWN_MS = 5 * 60 * 1000;

export const CloudHealthStatus = {
  OK: 'ok',
  LIMITED: 'limited',
  PAUSED: 'paused',
  UNKNOWN: 'unknown',
};

function readState() {
  try {
    const raw = localStorage.getItem(CLOUD_HEALTH_STORAGE_KEY);
    if (!raw) return { status: CloudHealthStatus.OK, updatedAt: null, message: '' };
    const parsed = JSON.parse(raw);
    return {
      status: parsed.status || CloudHealthStatus.UNKNOWN,
      updatedAt: parsed.updatedAt || null,
      message: parsed.message || '',
    };
  } catch {
    return { status: CloudHealthStatus.UNKNOWN, updatedAt: null, message: '' };
  }
}

function writeState(next) {
  try {
    localStorage.setItem(CLOUD_HEALTH_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota errors on meta key */
  }
}

export function getCloudHealth() {
  return readState();
}

export function classifyCloudResponse(status, body = {}) {
  const err = String(body.error || body.message || '');
  if (status === 507 || err === 'blob-quota-exceeded' || /quota|exceeded/i.test(err)) {
    return CloudHealthStatus.LIMITED;
  }
  if (status === 429 || status === 503 || /paused|rate limit|too many/i.test(err)) {
    return CloudHealthStatus.PAUSED;
  }
  if (status >= 500) return CloudHealthStatus.UNKNOWN;
  return CloudHealthStatus.OK;
}

export function recordCloudSuccess() {
  writeState({ status: CloudHealthStatus.OK, updatedAt: new Date().toISOString(), message: '' });
}

export function recordCloudFailure(status, body = {}) {
  const health = classifyCloudResponse(status, body);
  if (health === CloudHealthStatus.OK) return;
  const message =
    body.message ||
    body.error ||
    (health === CloudHealthStatus.LIMITED
      ? '클라우드 저장 용량이 제한되었습니다.'
      : health === CloudHealthStatus.PAUSED
        ? '클라우드 접근이 일시 중지되었습니다.'
        : '클라우드 요청에 실패했습니다.');
  writeState({ status: health, updatedAt: new Date().toISOString(), message: String(message) });
}

export function canAttemptCloudWrite() {
  const { status, updatedAt } = readState();
  if (status === CloudHealthStatus.OK) return true;
  if (!updatedAt) return true;
  const elapsed = Date.now() - new Date(updatedAt).getTime();
  return elapsed >= CLOUD_WRITE_COOLDOWN_MS;
}

export function getCloudHealthUserMessage() {
  const { status, message } = readState();
  if (status === CloudHealthStatus.OK) return null;
  const base =
    message ||
    (status === CloudHealthStatus.LIMITED
      ? '클라우드 공유가 용량 제한으로 일시 중단되었습니다.'
      : status === CloudHealthStatus.PAUSED
        ? '클라우드 공유가 일시 제한되었습니다.'
        : '클라우드 공유에 문제가 있습니다.');
  return `${base} 브라우저 로컬 저장은 계속됩니다. 잠시 후 다시 시도하거나 운영자에게 문의하세요.`;
}
