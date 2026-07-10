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

async function callJournalSnapshotsApi({
  method = 'GET',
  memberCode,
  scope,
  payload,
  updatedAt,
} = {}) {
  const code = String(memberCode || '').trim();
  let path = JOURNAL_SNAPSHOTS_API;
  if (method === 'GET') {
    if (scope === 'team') {
      path = `${JOURNAL_SNAPSHOTS_API}?scope=team`;
    } else {
      path = `${JOURNAL_SNAPSHOTS_API}?memberCode=${encodeURIComponent(code)}`;
    }
  }
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
      // Only lock the admin gate for /admin session failures — not member-route 403s (J7b).
      if (/관리자 세션/.test(String(body.message || ''))) {
        lockAdminGate();
      }
      return result({
        ok: false,
        status: 'forbidden',
        message:
          body.message ||
          '관리자 세션이 만료되었습니다. /admin 에서 비밀번호를 다시 입력하세요.',
      });
    }

    if (response.status === 400 && body.status === 'empty-payload') {
      return result({
        ok: false,
        status: 'empty-payload',
        message: body.message || '빈 일지로는 원격 스냅샷을 덮어쓸 수 없습니다.',
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
 * Load member journal snapshot via /api/journal-snapshots (admin-session or same-member referer).
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

/**
 * Merge A/B/C Supabase rows into a team cloud snapshot (J7c).
 * @param {Array<object>|null|undefined} rows
 * @returns {object|null}
 */
export function buildTeamJournalCloudSnapshotFromSupabaseRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const memberJournals = {};
  const memberUpdatedAt = {};
  let updatedAt = null;

  list.forEach((row) => {
    const code = String(row?.member_code || row?.memberCode || '').trim();
    if (!code) return;
    const at = resolveRemoteSnapshotUpdatedAt(row);
    const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
    memberJournals[code] = {
      ...payload,
      updatedAt: at || payload.updatedAt || null,
      savedAt: at || payload.savedAt || null,
    };
    if (at) {
      memberUpdatedAt[code] = at;
      if (!updatedAt || new Date(at).getTime() > new Date(updatedAt).getTime()) {
        updatedAt = at;
      }
    }
  });

  if (!Object.keys(memberJournals).length) return null;

  return normalizeJournalCloudSnapshot({
    publishedAt: updatedAt,
    meta: { updatedAt, memberUpdatedAt },
    memberJournals,
  });
}

/**
 * J7c: load team journal snapshot via GET ?scope=team (admin or member referer).
 * @returns {Promise<{ ok: boolean, status: string, message: string, data?: object|null, snapshot: object|null, source: 'supabase' }>}
 */
export async function fetchTeamJournalSnapshotFromSupabase() {
  const apiResult = await callJournalSnapshotsApi({ method: 'GET', scope: 'team' });
  if (!apiResult.ok) {
    return { ...apiResult, snapshot: null, source: 'supabase' };
  }

  const rows = Array.isArray(apiResult.data?.rows) ? apiResult.data.rows : [];
  if (!rows.length || apiResult.status === 'empty') {
    return {
      ok: true,
      status: 'empty',
      message: apiResult.message || 'No journal snapshots found.',
      data: apiResult.data,
      snapshot: null,
      source: 'supabase',
    };
  }

  const snapshot = buildTeamJournalCloudSnapshotFromSupabaseRows(rows);
  return {
    ok: true,
    status: snapshot ? 'ok' : 'empty',
    message: apiResult.message || 'ok',
    data: apiResult.data,
    snapshot,
    source: 'supabase',
  };
}
