import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';

const CSR_ATTACHMENTS_TABLE = 'csr_request_attachments';
const CSR_ATTACHMENTS_BUCKET = 'csr-attachments';

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

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `att-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Strip characters Supabase Storage paths don't like, keep it readable. */
function sanitizeFileNameForPath(fileName) {
  const name = String(fileName || 'file').trim() || 'file';
  return name.replace(/[^\w.\-가-힣 ]/g, '_').slice(0, 150);
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

/**
 * Upload one file to Storage then record it against the CSR request.
 * @param {{ requestId: string, file: File, uploadedBy: string }} args
 */
export async function uploadCsrAttachmentToSupabase({ requestId, file, uploadedBy } = {}) {
  if (!requestId) return result({ ok: false, status: 'error', message: 'requestId is required.' });
  if (!file) return result({ ok: false, status: 'error', message: 'file is required.' });
  if (!isConfigured()) return supabaseDisabledResult();

  const client = getSupabaseClient();
  if (!client) return supabaseDisabledResult();

  const precheck = validateCsrAttachmentFile(file);
  if (!precheck.ok) {
    return result({ ok: false, status: 'error', message: precheck.message });
  }

  try {
    const storagePath = `${requestId}/${randomId()}-${sanitizeFileNameForPath(file.name)}`;

    const { error: uploadError } = await client.storage
      .from(CSR_ATTACHMENTS_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      return result({ ok: false, status: 'error', message: uploadError.message });
    }

    const { data, error: insertError } = await client
      .from(CSR_ATTACHMENTS_TABLE)
      .insert({
        request_id: requestId,
        file_name: file.name,
        storage_path: storagePath,
        file_size_bytes: file.size,
        content_type: file.type || null,
        uploaded_by: String(uploadedBy || '').trim(),
      })
      .select()
      .single();

    if (insertError) {
      // Storage object is orphaned but harmless (private-by-convention path, never linked from any row).
      return result({ ok: false, status: 'error', message: insertError.message });
    }

    return result({
      ok: true,
      status: 'ok',
      message: 'CSR attachment uploaded.',
      data: normalizeCsrAttachment(data),
    });
  } catch (error) {
    return unexpectedErrorResult(error, 'upload');
  }
}
