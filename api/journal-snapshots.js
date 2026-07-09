import { createClient } from '@supabase/supabase-js';
import { hasValidAdminSession } from '../server/api-utils/adminSession.js';
import { isAllowedPublishOrigin } from '../server/api-utils/publishOrigin.js';
import { isAdminRouteReferer } from '../server/api-utils/requestScope.js';

const JOURNAL_SNAPSHOTS_TABLE = 'journal_snapshots';
const PAYLOAD_VERSION = 1;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function getServiceClient() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function canUseAdminWrite(req) {
  const referer = req.headers.referer || req.headers.origin || '';
  if (!isAllowedPublishOrigin(referer)) return false;
  if (!isAdminRouteReferer(req)) return false;
  return hasValidAdminSession(req);
}

function normalizeMemberCode(value) {
  return String(value || '').trim();
}

function normalizeSnapshotRow(row) {
  if (!row || typeof row !== 'object') return null;
  const memberCode = normalizeMemberCode(row.member_code || row.memberCode);
  if (!memberCode) return null;
  return {
    member_code: memberCode,
    payload: row.payload ?? null,
    payload_version: Number(row.payload_version || row.payloadVersion || PAYLOAD_VERSION) || PAYLOAD_VERSION,
    updated_at: row.updated_at || row.updatedAt || null,
  };
}

function isSnapshotWriteStale(currentUpdatedAt, clientUpdatedAt) {
  if (!currentUpdatedAt) return false;
  if (!clientUpdatedAt) return true;
  const currentMs = new Date(currentUpdatedAt).getTime();
  const clientMs = new Date(clientUpdatedAt).getTime();
  if (!Number.isFinite(currentMs)) return false;
  if (!Number.isFinite(clientMs)) return true;
  return currentMs > clientMs;
}

export default async function handler(req, res) {
  const client = getServiceClient();
  if (!client) {
    return json(res, 501, {
      ok: false,
      status: 'disabled',
      message: 'Supabase service role is not configured on the server.',
    });
  }

  if (!canUseAdminWrite(req)) {
    return json(res, 403, {
      ok: false,
      status: 'forbidden',
      message: '관리자 세션이 필요합니다. /admin 에서 비밀번호를 다시 입력하세요.',
    });
  }

  if (req.method === 'GET') {
    const memberCode = normalizeMemberCode(req.query?.memberCode);
    if (!memberCode) {
      return json(res, 400, {
        ok: false,
        status: 'error',
        message: 'memberCode is required.',
      });
    }

    try {
      const { data, error } = await client
        .from(JOURNAL_SNAPSHOTS_TABLE)
        .select('member_code, payload, payload_version, updated_at')
        .eq('member_code', memberCode)
        .maybeSingle();

      if (error) {
        return json(res, 500, {
          ok: false,
          status: 'error',
          message: error.message,
        });
      }

      if (!data) {
        return json(res, 200, {
          ok: true,
          status: 'empty',
          message: 'Journal snapshot was not found.',
          data: null,
        });
      }

      return json(res, 200, {
        ok: true,
        status: 'ok',
        message: 'Journal snapshot loaded from Supabase.',
        data: normalizeSnapshotRow(data),
      });
    } catch (error) {
      return json(res, 500, {
        ok: false,
        status: 'error',
        message: error instanceof Error ? error.message : 'Journal snapshot read failed.',
      });
    }
  }

  if (req.method === 'POST') {
    const memberCode = normalizeMemberCode(req.body?.memberCode);
    const payload = req.body?.payload;
    const clientUpdatedAt = typeof req.body?.updatedAt === 'string' ? req.body.updatedAt : null;
    const updatedAt = clientUpdatedAt || new Date().toISOString();

    if (!memberCode) {
      return json(res, 400, {
        ok: false,
        status: 'error',
        message: 'memberCode is required.',
      });
    }

    if (payload == null) {
      return json(res, 400, {
        ok: false,
        status: 'error',
        message: 'payload is required.',
      });
    }

    try {
      const { data: currentRow, error: readError } = await client
        .from(JOURNAL_SNAPSHOTS_TABLE)
        .select('member_code, payload, payload_version, updated_at')
        .eq('member_code', memberCode)
        .maybeSingle();

      if (readError) {
        return json(res, 500, {
          ok: false,
          status: 'error',
          message: readError.message,
        });
      }

      const current = normalizeSnapshotRow(currentRow);
      if (isSnapshotWriteStale(current?.updated_at, clientUpdatedAt)) {
        return json(res, 409, {
          ok: false,
          status: 'conflict',
          message:
            'Supabase에 더 최신 업무일지 스냅샷이 있습니다. 최신 원격 상태를 확인한 뒤 다시 저장해 주세요.',
          data: current,
        });
      }

      const { data, error } = await client
        .from(JOURNAL_SNAPSHOTS_TABLE)
        .upsert(
          {
            member_code: memberCode,
            payload,
            payload_version: PAYLOAD_VERSION,
            updated_at: updatedAt,
          },
          { onConflict: 'member_code' }
        )
        .select('member_code, payload, payload_version, updated_at')
        .single();

      if (error) {
        return json(res, 500, {
          ok: false,
          status: 'error',
          message: error.message,
        });
      }

      return json(res, 200, {
        ok: true,
        status: 'ok',
        message: 'Journal snapshot saved to Supabase.',
        data: normalizeSnapshotRow(data),
      });
    } catch (error) {
      return json(res, 500, {
        ok: false,
        status: 'error',
        message: error instanceof Error ? error.message : 'Journal snapshot save failed.',
      });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return json(res, 405, { error: 'method not allowed' });
}
