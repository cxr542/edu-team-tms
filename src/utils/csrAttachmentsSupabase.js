import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';

const CSR_ATTACHMENTS_TABLE = 'csr_request_attachments';
const CSR_ATTACHMENTS_BUCKET = 'csr-attachments';
const CSR_ATTACHMENTS_API = '/api/csr-attachments';

export const CSR_ATTACHMENT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
export const CSR_ATTACHMENT_MAX_COUNT = 5;

function result({ ok, status, message, data = null }) {
  return { ok, status, message, data };
}

function isConfigured() {
  if (!isSupabaseConfigured) return false;
  return Boolean(getSupabaseClient());
}

function supabaseDisabledResult() {
  return result({
    ok: false,
    status: 'disabled',
    message: 'Supabase environment variables are not configured.',
  });
}

function unexpectedErrorResult(error, operation) {
  return result({
    ok: false,
    status: 'error',
    message:
      error instanceof Error ? error.message : `Unknown Supabase CSR attachment ${operation} error.`,
  });
}

export function formatCsrAttachmentSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Client-side pre-check before even attempting an upload.
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateCsrAttachmentFile(file, existingCount = 0) {
  if (!file) return { ok: false, message: '파일이 없습니다.' };
  if (existingCount >= CSR_ATTACHMENT_MAX_COUNT) {
    return { ok: false, message: `요청당 첨부파일은 최대 ${CSR_ATTACHMENT_MAX_COUNT}개까지 가능합니다.` };
  }
  if (file.size <= 0) {
    return { ok: false, message: '빈 파일은 첨부할 수 없습니다.' };
  }
  if (file.size > CSR_ATTACHMENT_MAX_FILE_BYTES) {
    return {
      ok: false,
      message: `파일 1개당 최대 ${formatCsrAttachmentSize(CSR_ATTACHMENT_MAX_FILE_BYTES)}까지 첨부할 수 있습니다. (${file.name}: ${formatCsrAttachmentSize(file.size)})`,
    };
  }
  return { ok: true };
}

function normalizeCsrAttachment(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: String(row.id || '').trim(),
    requestId: String(row.request_id || row.requestId || '').trim(),
    fileName: String(row.file_name || row.fileName || '').trim(),
    storagePath: String(row.storage_path || row.storagePath || '').trim(),
    fileSizeBytes: Number(row.file_size_bytes ?? row.fileSizeBytes ?? 0),
    contentType: row.content_type || row.contentType || null,
    uploadedBy: String(row.uploaded_by || row.uploadedBy || '').trim(),
    createdAt: row.created_at || row.createdAt || null,
  };
}

/** Public URL for a stored attachment (bucket is public — no signed URL needed). */
export function getCsrAttachmentPublicUrl(storagePath) {
  const client = getSupabaseClient();
  if (!client || !storagePath) return null;
  const { data } = client.storage.from(CSR_ATTACHMENTS_BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl || null;
}

export async function listCsrAttachmentsFromSupabase(requestId) {
  if (!requestId) return result({ ok: false, status: 'error', message: 'requestId is required.' });
  if (!isConfigured()) return supabaseDisabledResult();

  const client = getSupabaseClient();
  if (!client) return supabaseDisabledResult();

  try {
    const { data, error } = await client
      .from(CSR_ATTACHMENTS_TABLE)
      .select('id, request_id, file_name, storage_path, file_size_bytes, content_type, uploaded_by, created_at')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });

    if (error) {
      return result({ ok: false, status: 'error', message: error.message });
    }

    return result({
      ok: true,
      status: 'ok',
      message: 'CSR attachments loaded from Supabase.',
      data: (data || []).map(normalizeCsrAttachment).filter(Boolean),
    });
  } catch (error) {
    return unexpectedErrorResult(error, 'list');
  }
}

/** 서버 경로 호출. sign(업로드 토큰 발급)과 register(첨부 행 기록)에 쓴다. */
async function callAttachmentsApi(body) {
  let res;
  try {
    res = await fetch(CSR_ATTACHMENTS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch (error) {
    return result({ ok: false, status: 'error', message: error?.message || '네트워크 오류' });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    return result({
      ok: false,
      status: res.status === 403 ? 'forbidden' : res.status === 409 ? 'conflict' : 'error',
      message: data?.message || `HTTP ${res.status}`,
    });
  }
  return result({ ok: true, status: 'ok', message: 'ok', data: data?.data ?? null });
}

/**
 * 파일 1개를 올리고 CSR 요청에 첨부로 기록한다. 직접 쓰지 않고 서버 경로를 거친다.
 *  1) sign: 서버가 검사 후 경로와 1회용 업로드 토큰을 준다
 *  2) 그 토큰으로 저장소에 직접 업로드(파일 본문은 서버를 거치지 않는다)
 *  3) register: 서버가 업로드를 확인하고 첨부 행을 기록한다(올린 사람 표시도 서버가 정한다)
 * @param {{ requestId: string, file: File }} args
 */
export async function uploadCsrAttachmentToSupabase({ requestId, file } = {}) {
  if (!requestId) return result({ ok: false, status: 'error', message: 'requestId is required.' });
  if (!file) return result({ ok: false, status: 'error', message: 'file is required.' });
  if (!isConfigured()) return supabaseDisabledResult();

  const client = getSupabaseClient();
  if (!client) return supabaseDisabledResult();

  const precheck = validateCsrAttachmentFile(file);
  if (!precheck.ok) {
    return result({ ok: false, status: 'error', message: precheck.message });
  }

  const info = {
    requestId,
    fileName: file.name,
    size: file.size,
    contentType: file.type || undefined,
  };

  const signed = await callAttachmentsApi({ action: 'sign', ...info });
  if (!signed.ok) return signed;
  const { path, token } = signed.data || {};
  if (!path || !token) {
    return result({ ok: false, status: 'error', message: '업로드 주소를 받지 못했습니다.' });
  }

  try {
    const { error: uploadError } = await client.storage
      .from(CSR_ATTACHMENTS_BUCKET)
      .uploadToSignedUrl(path, token, file, {
        contentType: file.type || 'application/octet-stream',
      });
    if (uploadError) {
      return result({ ok: false, status: 'error', message: uploadError.message });
    }
  } catch (error) {
    return unexpectedErrorResult(error, 'upload');
  }

  // 업로드는 됐지만 기록이 실패하면 저장소에 연결되지 않은 파일이 남는다(화면에는 보이지 않는다).
  const registered = await callAttachmentsApi({ action: 'register', ...info, path });
  if (!registered.ok) return registered;
  return result({
    ok: true,
    status: 'ok',
    message: 'CSR attachment uploaded.',
    data: normalizeCsrAttachment(registered.data),
  });
}
