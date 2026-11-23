/**
 * KPI 승인 행 쓰기 (service role). 읽기는 브라우저가 anon 으로 직접 하고, 이 파일은 읽지 않는다.
 *
 * - POST   구성원 "제출·회수". 관리자 세션이 있는 /admin 요청이거나, 요청한 화면 주소의 구성원 코드가
 *          대상 구성원과 같을 때만 받는다. 받는 상태는 작성중·제출뿐이고, 상태·제출 시각은 서버가 정하며
 *          승인자·승인 시각·반려 사유는 항상 비운다. 이미 "승인"된 행은 구성원 경로로 덮어쓸 수 없다(409).
 * - PATCH  관리자 "승인·반려". 관리자 세션이 필수다. 기존 행의 내용은 그대로 두고 상태·승인자·반려 사유만
 *          바꾸며, 승인 시각은 서버가 정한다. 제출되지 않은(작성중) 행은 승인할 수 없다(409).
 *
 * 두 종류를 같은 경로로 다룬다: kind 'monthly'(KPI1 월별) / 'kpi2'(KPI2 행별).
 * Origin/Referer 는 인증이 아니다. 구성원 확인은 "같은 주소에서 온 요청인지"만 보는 약한 검사이고,
 * 승인·반려는 관리자 세션 쿠키로 실제 보호한다.
 */
import { canUseAdminWrite } from './adminWriteGuard.js';
import { readJsonBody } from './announcementEngagement.js';
import { isAllowedPublishOrigin } from './publishOrigin.js';
import { memberCodeFromReferer } from './requestScope.js';
import { defaultMonthly01 } from '../../src/constants/kpiOperationalStore.js';
import { KPI_STATUS } from '../../src/constants/kpiStatuses.js';
import { findKpiMember } from '../../src/constants/kpiMembers.js';

const PAYLOAD_VERSION = 1;
const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const LIMITS = { taskId: 120, note: 2_000, approver: 40, rejectReason: 500, number: 100_000 };
const DEFAULT_APPROVER = '팀장';
const NUMBER_FIELDS = ['work', 'improve', 'leave', 'available'];

const KINDS = {
  monthly: {
    table: 'kpi_monthly_approvals',
    payloadColumn: 'monthly01',
  },
  kpi2: {
    table: 'kpi2_row_approvals',
    payloadColumn: 'kpi2_row_status',
  },
};

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function fail(res, status, code, message) {
  return json(res, status, { ok: false, status: code, message });
}

function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function saveFailed(res, error) {
  // DB 오류 문구는 로그에만 남기고, 호출자에게는 일반 문구만 돌려준다.
  console.error('[kpi-approvals] save failed:', error?.message || error);
  return fail(res, 500, 'error', 'KPI 승인 정보를 저장하지 못했습니다.');
}

/** 구성원이 보낼 수 있는 상태: 작성중(회수)·제출. 그 외(승인·반려·모르는 값)는 거절한다. */
function readMemberStatus(raw) {
  const value = asText(raw).toLowerCase();
  if (value === KPI_STATUS.DRAFT || value === 'draft') return { dbStatus: 'draft', label: KPI_STATUS.DRAFT };
  if (value === KPI_STATUS.SUBMITTED || value === 'submitted') {
    return { dbStatus: 'submitted', label: KPI_STATUS.SUBMITTED };
  }
  return null;
}

/** 대상 행을 가리키는 값(kind·구성원·월/날짜·과제). 올바르면 { target }, 아니면 { message }. */
function readTarget(body) {
  const kind = asText(body.kind);
  if (!Object.hasOwn(KINDS, kind)) return { message: 'kind 가 올바르지 않습니다.' };
  const member = findKpiMember(asText(body.memberCode));
  if (!member) return { message: '구성원 코드가 올바르지 않습니다.' };

  if (kind === 'monthly') {
    const yearMonth = asText(body.yearMonth);
    if (!YEAR_MONTH_RE.test(yearMonth)) return { message: 'yearMonth 는 YYYY-MM 형식이어야 합니다.' };
    return { target: { kind, memberCode: member.code, keys: { member_code: member.code, year_month: yearMonth } } };
  }

  const dayKey = asText(body.dayKey);
  if (!DAY_KEY_RE.test(dayKey)) return { message: 'dayKey 는 YYYY-MM-DD 형식이어야 합니다.' };
  const taskId = asText(body.taskId);
  // 화면이 `구성원|날짜|과제` 로 행 id 를 만들어 다시 쪼개므로, 과제 id 에 '|' 는 허용하지 않는다.
  if (!taskId || taskId.length > LIMITS.taskId || taskId.includes('|')) {
    return { message: 'taskId 가 올바르지 않습니다.' };
  }
  return {
    target: {
      kind,
      memberCode: member.code,
      keys: { member_code: member.code, day_key: dayKey, task_id: taskId },
    },
  };
}

function readNumber(raw, fallback) {
  if (raw === undefined) return { value: fallback };
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > LIMITS.number) {
    return { message: '수치 값이 올바르지 않습니다.' };
  }
  return { value: raw };
}

/** 구성원이 보낸 기록에서 허용한 값만 골라 서버가 상태 필드를 채운다. 잘못된 값이면 { message }. */
function buildMemberPayload(kind, record, status, now) {
  const base = {
    status: status.label,
    submittedAt: status.dbStatus === 'submitted' ? now : null,
    approvedAt: null,
    approver: '',
    rejectReason: '',
  };
  if (kind === 'kpi2') return { payload: base };

  const defaults = defaultMonthly01();
  const payload = { ...base };
  for (const field of NUMBER_FIELDS) {
    const parsed = readNumber(record[field], defaults[field]);
    if (parsed.message) return { message: parsed.message };
    payload[field] = parsed.value;
  }
  if (record.note !== undefined && typeof record.note !== 'string') return { message: '메모가 올바르지 않습니다.' };
  const note = record.note ?? defaults.note;
  if (note.length > LIMITS.note) return { message: `메모는 ${LIMITS.note}자까지 입력할 수 있습니다.` };
  payload.note = note;
  // 회수 시각을 남겨 두면 화면이 옛 제출본을 병합할 때 철회가 덮이지 않는다.
  if (status.dbStatus === 'draft') payload.withdrawnAt = now;
  return { payload };
}

function applyFilters(query, keys) {
  return Object.entries(keys).reduce((q, [column, value]) => q.eq(column, value), query);
}

function toResponse(target, row) {
  const { payloadColumn } = KINDS[target.kind];
  const { keys } = target;
  const ids =
    target.kind === 'monthly' ? { yearMonth: keys.year_month } : { dayKey: keys.day_key, taskId: keys.task_id };
  return {
    kind: target.kind,
    memberCode: target.memberCode,
    ...ids,
    status: row.status,
    record: row[payloadColumn],
  };
}

async function submitRecord(req, res, client) {
  const source = req.headers?.referer || req.headers?.origin || '';
  if (!isAllowedPublishOrigin(source)) {
    return fail(res, 403, 'forbidden', '허용되지 않은 요청입니다.');
  }
  const admin = canUseAdminWrite(req);
  const refererMember = memberCodeFromReferer(req);
  if (!admin && !refererMember) {
    return fail(res, 403, 'forbidden', '구성원 화면 또는 관리자 화면에서만 제출할 수 있습니다.');
  }

  const body = await readJsonBody(req);
  if (!isPlainObject(body)) return fail(res, 400, 'error', '요청 본문이 올바르지 않습니다.');

  const parsedTarget = readTarget(body);
  if (parsedTarget.message) return fail(res, 400, 'error', parsedTarget.message);
  const { target } = parsedTarget;
  if (!admin && refererMember !== target.memberCode) {
    return fail(res, 403, 'forbidden', '본인 화면에서만 제출할 수 있습니다.');
  }

  const record = isPlainObject(body.record) ? body.record : {};
  const status = readMemberStatus(record.status);
  if (!status) return fail(res, 400, 'error', '상태는 작성중 또는 제출만 보낼 수 있습니다.');

  const now = new Date().toISOString();
  const built = buildMemberPayload(target.kind, record, status, now);
  if (built.message) return fail(res, 400, 'error', built.message);

  const { table, payloadColumn } = KINDS[target.kind];
  const { data: found, error: findError } = await applyFilters(client.from(table).select('id, status'), target.keys);
  if (findError) return saveFailed(res, findError);
  const current = found?.[0];

  // 이미 승인된 행은 구성원이 덮어쓸 수 없다(관리자 세션이 있는 /admin 요청만 가능).
  if (current?.status === 'approved' && !admin) {
    return fail(res, 409, 'conflict', '이미 승인된 항목은 변경할 수 없습니다.');
  }

  // 운영 DB 의 kpi2_row_approvals 에는 year_month(NOT NULL, 기본값 없음)가 있어 날짜에서 뽑아 넣는다.
  // 운영 테이블에는 created_at 컬럼이 없으므로(저장소 SQL 과 다름) 보내지 않는다.
  const yearMonthColumn = target.kind === 'kpi2' ? { year_month: target.keys.day_key.slice(0, 7) } : {};
  const columns = {
    ...yearMonthColumn,
    status: status.dbStatus,
    submitted_at: built.payload.submittedAt,
    approved_at: null,
    approver: null,
    reject_reason: null,
    [payloadColumn]: built.payload,
    payload_version: PAYLOAD_VERSION,
    updated_at: now,
  };

  const { data, error } = current
    ? await applyFilters(client.from(table).update(columns), target.keys).select()
    : await client.from(table).insert({ ...target.keys, ...columns }).select();
  if (error) return saveFailed(res, error);
  const saved = data?.[0];
  if (!saved) return fail(res, 404, 'not-found', '항목을 찾을 수 없습니다.');
  return json(res, 200, { ok: true, status: 'ok', data: toResponse(target, saved) });
}

async function decideRecord(req, res, client) {
  if (!canUseAdminWrite(req)) {
    return fail(res, 403, 'forbidden', '관리자 화면에서만 승인·반려할 수 있습니다.');
  }

  const body = await readJsonBody(req);
  if (!isPlainObject(body)) return fail(res, 400, 'error', '요청 본문이 올바르지 않습니다.');

  const parsedTarget = readTarget(body);
  if (parsedTarget.message) return fail(res, 400, 'error', parsedTarget.message);
  const { target } = parsedTarget;

  const action = asText(body.action);
  if (action !== 'approve' && action !== 'reject') {
    return fail(res, 400, 'error', 'action 은 approve 또는 reject 여야 합니다.');
  }
  const approver = asText(body.approver) || DEFAULT_APPROVER;
  if (approver.length > LIMITS.approver) {
    return fail(res, 400, 'error', `승인자는 ${LIMITS.approver}자까지 입력할 수 있습니다.`);
  }
  if (body.reason !== undefined && typeof body.reason !== 'string') {
    return fail(res, 400, 'error', '반려 사유가 올바르지 않습니다.');
  }
  const reason = asText(body.reason) || '반려';
  if (reason.length > LIMITS.rejectReason) {
    return fail(res, 400, 'error', `반려 사유는 ${LIMITS.rejectReason}자까지 입력할 수 있습니다.`);
  }

  const { table, payloadColumn } = KINDS[target.kind];
  const { data: found, error: findError } = await applyFilters(
    client.from(table).select(`id, status, ${payloadColumn}`),
    target.keys
  );
  if (findError) return saveFailed(res, findError);
  const current = found?.[0];
  if (!current) return fail(res, 404, 'not-found', '항목을 찾을 수 없습니다.');
  if (current.status === 'draft') {
    return fail(res, 409, 'conflict', '제출되지 않은 항목은 승인·반려할 수 없습니다.');
  }

  const now = new Date().toISOString();
  const approved = action === 'approve';
  const rejectReason = approved ? '' : reason;
  // 기존 기록의 내용(수치·메모 등)은 그대로 두고 상태 필드만 바꾼다.
  const payload = {
    ...(isPlainObject(current[payloadColumn]) ? current[payloadColumn] : {}),
    status: approved ? KPI_STATUS.APPROVED : KPI_STATUS.REJECTED,
    approvedAt: now,
    approver,
    rejectReason,
  };

  const { data, error } = await applyFilters(
    client.from(table).update({
      status: approved ? 'approved' : 'rejected',
      approved_at: now,
      approver,
      reject_reason: rejectReason || null,
      [payloadColumn]: payload,
      updated_at: now,
    }),
    target.keys
  ).select();
  if (error) return saveFailed(res, error);
  if (!data?.[0]) return fail(res, 404, 'not-found', '항목을 찾을 수 없습니다.');
  return json(res, 200, { ok: true, status: 'ok', data: toResponse(target, data[0]) });
}

export async function handleKpiApprovals(req, res, client) {
  if (req.method === 'POST') return submitRecord(req, res, client);
  if (req.method === 'PATCH') return decideRecord(req, res, client);
  res.setHeader('Allow', 'POST, PATCH');
  return fail(res, 405, 'error', 'method not allowed');
}
