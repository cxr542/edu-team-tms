/** Vercel Blob SDK 옵션 — BLOB_READ_WRITE_TOKEN 또는 OIDC(BLOB_STORE_ID) */

export function getBlobReadWriteToken() {
  return (
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.tms_journal_READ_WRITE_TOKEN ||
    process.env.tms_ledger_READ_WRITE_TOKEN ||
    ''
  );
}

/** Blob read/write 가능 여부 (정적 토큰 또는 OIDC 스토어 연결) */
export function isBlobConfigured() {
  if (getBlobReadWriteToken()) return true;
  return Boolean(process.env.BLOB_STORE_ID);
}

/**
 * @vercel/blob 호출 옵션.
 * token을 명시하지 않으면 SDK가 VERCEL_OIDC_TOKEN + BLOB_STORE_ID 를 사용.
 */
export function getBlobSdkOptions() {
  const token = getBlobReadWriteToken();
  if (token) return { token };
  if (process.env.BLOB_STORE_ID) return {};
  return null;
}

export function assertBlobConfigured() {
  if (!isBlobConfigured()) {
    const err = new Error('Blob not configured (BLOB_STORE_ID or BLOB_READ_WRITE_TOKEN)');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
}

export async function withRetry(fn, maxAttempts = 3, delayMs = 300) {
  const isTest = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.VITEST);
  const actualMaxAttempts = isTest ? 1 : maxAttempts;
  const actualDelayMs = isTest ? 0 : delayMs;

  let lastError;
  let currentDelay = actualDelayMs;
  for (let attempt = 1; attempt <= actualMaxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isTest) {
        console.warn(`⚠️ Vercel Blob API attempt ${attempt} failed: ${err.message || err}. Retrying in ${currentDelay}ms...`);
      }
      if (attempt < actualMaxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, currentDelay));
        currentDelay *= 2;
      }
    }
  }
  throw lastError;
}

export async function putWithRetry(path, data, options) {
  const { put } = await import('@vercel/blob');
  return withRetry(() => put(path, data, options));
}

export async function headWithRetry(path, options) {
  const { head } = await import('@vercel/blob');
  return withRetry(() => head(path, options));
}
