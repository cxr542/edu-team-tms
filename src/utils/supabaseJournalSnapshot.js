import { lockAdminGate } from '../constants/adminGate.js';
import { normalizeJournalCloudSnapshot } from './journalCloudSnapshot.js';
import { resolveRemoteSnapshotUpdatedAt } from './journalSupabaseFreshness.js';

const JOURNAL_SNAPSHOTS_API = '/api/journal-snapshots';
const PAYLOAD_VERSION = 1;

function result({ ok, status, message, data = null }) {
  return { ok, status, message, data };
}

function hasMemberCode(memberCode) {
  return typeof memberCode === 'string' && memberCode.trim().length > 0;
}

async function callJournalSnapshotsApi({ method = 'GET', memberCode, payload, updatedAt } = {}) {
  const code = String(memberCode || '').trim();
  const path =
    method === 'GET'
      ? `${JOURNAL_SNAPSHOTS_API}?memberCode=${encodeURIComponent(code)}`
      : JOURNAL_SNAPSHOTS_API;
  const postBody =
    method === 'POST'
      ? {
          memberCode: code,
          payload,
          payloadVersion: PAYLOAD_VERSION,
          ...(updatedAt ? { updatedAt } : {}),
        }
      : null;

  try {
    const response = await fetch(path, {
      method,
      credentials: 'include',
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: postBody ? JSON.stringify(postBody) : undefined,
    });
    const body = await response.json().catch(() => ({}));

    if (response.status === 403) {
      lockAdminGate();
      return result({
        ok: false,
        status: 'forbidden',
        message:
          body.message ||
          '관리자 세션이 만료되었습니다. /admin 에서 비밀번호를 다시 입력하세요.',
      });
    }

    if (response.status === 501) {
      return result({
        ok: false,
        status: 'disabled',
        message: body.message || 'Supabase service role is not configured on the server.',
      });
    }

    if (response.status === 409) {
      return result({
        ok: false,
        status: 'conflict',
        message:
          body.message ||
          'Supabase에 더 최신 업무일지 스냅샷이 있습니다. 최신 원격 상태를 확인한 뒤 다시 저장해 주세요.',
        data: body.data ?? null,
      });
    }

    if (!response.ok) {
      return result({
        ok: false,
        status: body.status || 'error',
        message: body.message || `Journal snapshots API failed (${response.status}).`,
        data: body.data ?? null,
      });
    }

    return result({
      ok: Boolean(body.ok),
      status: body.status || 'ok',
      message: body.message || 'ok',
      data: body.data ?? null,
    });
  } catch (error) {
    return result({
      ok: false,
      status: 'error',
      message: error instanceof Error ? error.message : 'Journal snapshots API request failed.',
    });
  }
}

/**
 * Save member journal snapshot via /api/journal-snapshots (admin-session + service role).
 * Does not use browser Supabase Auth.
 */
export async function saveJournalSnapshotToSupabase({ memberCode, payload, updatedAt } = {}) {
  if (!hasMemberCode(memberCode)) {
    return result({ ok: false, status: 'error', message: 'memberCode is required.' });
  }

  if (payload == null) {
    return result({ ok: false, status: 'error', message: 'payload is required.' });
  }

  return callJournalSnapshotsApi({
    method: 'POST',
    memberCode,
    payload,
    updatedAt,
  });
}

/**
 * Load member journal snapshot via /api/journal-snapshots (admin-session required).
 */
export async function getJournalSnapshotFromSupabase(memberCode) {
  if (!hasMemberCode(memberCode)) {
    return result({ ok: false, status: 'error', message: 'memberCode is required.' });
  }

  return callJournalSnapshotsApi({ method: 'GET', memberCode });
}

/**
 * Shape a Supabase journal_snapshots row into the cloud-snapshot form used by
 * applyRemoteMemberJournalSave (selected member slice only).
 */
export function buildMemberRemoteSnapshotFromSupabase(memberCode, data) {
  const code = String(memberCode || '').trim();
  const updatedAt = resolveRemoteSnapshotUpdatedAt(data);
  const payload = data?.payload && typeof data.payload === 'object' ? data.payload : {};
  return normalizeJournalCloudSnapshot({
    publishedAt: updatedAt || new Date().toISOString(),
    meta: {
      updatedAt: updatedAt || null,
      memberUpdatedAt: updatedAt ? { [code]: updatedAt } : {},
    },
    memberJournals: {
      [code]: payload,
    },
  });
}
