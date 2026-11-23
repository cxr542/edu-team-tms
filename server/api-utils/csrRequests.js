/**
 * CSR 요청 쓰기 (service role). 읽기는 브라우저가 anon 으로 직접 하고, 이 파일은 읽지 않는다.
 *
 * - POST   새 요청 등록. 관리자 세션이 있는 /admin 요청이거나, 요청한 화면 주소의 구성원 코드가
 *          요청자 코드와 같을 때만 받는다. id·status·관리자 코멘트·시각은 서버가 정하고,
 *          요청자 이름은 구성원 코드로 서버가 정한다(클라이언트가 보낸 값은 쓰지 않는다).
 * - PATCH  상태·관리자 코멘트, 그리고 제목·내용·분류 수정. 관리자 세션이 필수다. 요청자는 바꾸지 않는다.
 * - DELETE 요청 삭제. 관리자 세션이 필수다. 첨부 파일(저장소)을 먼저 지우고 요청 행을 지운다
 *          (첨부 행은 FK cascade 로 함께 지워진다).
 *
 * Origin/Referer 는 인증이 아니다. 구성원 확인은 "같은 주소에서 온 요청인지"만 보는 약한 검사이고,
 * 상태·코멘트를 바꾸는 쪽(PATCH)만 관리자 세션 쿠키로 실제 보호한다.
 */
import { randomUUID } from 'node:crypto';
import { canUseAdminWrite } from './adminWriteGuard.js';
import { readJsonBody } from './announcementEngagement.js';
import { isAllowedPublishOrigin } from './publishOrigin.js';
import { memberCodeFromReferer } from './requestScope.js';
import {
  CSR_REQUEST_CATEGORY_LABELS,
  CSR_REQUEST_STATUS_LABELS,
  formatCsrRequestCategoryLabel,
  normalizeCsrRequestCategory,
  normalizeCsrRequestStatus,
} from '../../src/constants/csrRequests.js';
import { findKpiMember } from '../../src/constants/kpiMembers.js';

const TABLE = 'csr_requests';
const ATTACHMENTS_BUCKET = 'csr-attachments';
const PAYLOAD_VERSION = 1;
const LIMITS = { title: 200, description: 20_000, adminComment: 2_000 };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** 클라이언트 normalizeCsrRequest 와 같은 모양으로 돌려준다(화면 코드를 바꾸지 않고 갈아 끼우기 위해). */
function toRequest(row) {
  return {
    id: String(row.id || '').trim(),
    title: String(row.title || '').trim(),
    description: typeof row.description === 'string' ? row.description.trim() : '',
    category: normalizeCsrRequestCategory(row.category),
    status: normalizeCsrRequestStatus(row.status),
    requester: String(row.requester || '').trim(),
    requesterCode: String(row.requester_code || '').trim(),
    adminComment: typeof row.admin_comment === 'string' ? row.admin_comment.trim() : '',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    completedAt: row.completed_at || null,
    categoryLabel: formatCsrRequestCategoryLabel(row.category),
  };
}

function saveFailed(res, error) {
  // DB 오류 문구는 로그에만 남기고, 호출자에게는 일반 문구만 돌려준다.
  console.error('[csr-requests] save failed:', error?.message || error);
  return fail(res, 500, 'error', 'CSR 요청을 저장하지 못했습니다.');
}

/** 제목·내용·분류 검사(등록·수정 공통). 값이 올바르면 { value }, 아니면 { message }. */
function readTitle(raw) {
  const title = asText(raw);
  if (!title) return { message: '제목을 입력해 주세요.' };
  if (title.length > LIMITS.title) return { message: `제목은 ${LIMITS.title}자까지 입력할 수 있습니다.` };
  return { value: title };
}

function readDescription(raw) {
  const description = asText(raw);
  if (description.length > LIMITS.description) {
    return { message: `내용은 ${LIMITS.description}자까지 입력할 수 있습니다.` };
  }
  return { value: description };
}

function readCategory(raw) {
  const category = asText(raw);
  if (!Object.hasOwn(CSR_REQUEST_CATEGORY_LABELS, category)) return { message: '분류가 올바르지 않습니다.' };
  return { value: category };
}

async function createRequest(req, res, client) {
  const source = req.headers?.referer || req.headers?.origin || '';
  if (!isAllowedPublishOrigin(source)) {
    return fail(res, 403, 'forbidden', '허용되지 않은 요청입니다.');
  }
  const admin = canUseAdminWrite(req);
  const refererMember = memberCodeFromReferer(req);
  if (!admin && !refererMember) {
    return fail(res, 403, 'forbidden', '구성원 화면 또는 관리자 화면에서만 요청을 등록할 수 있습니다.');
  }

  const body = await readJsonBody(req);
  if (!isPlainObject(body)) {
    return fail(res, 400, 'error', '요청 본문이 올바르지 않습니다.');
  }

  const requesterCode = asText(body.requesterCode);
  if (!admin && refererMember !== requesterCode) {
    return fail(res, 403, 'forbidden', '본인 화면에서만 요청을 등록할 수 있습니다.');
  }
  const member = findKpiMember(requesterCode);
  if (!member) {
    return fail(res, 400, 'error', '요청자 코드가 올바르지 않습니다.');
  }

  const title = readTitle(body.title);
  if (title.message) return fail(res, 400, 'error', title.message);
  const description = readDescription(body.description);
  if (description.message) return fail(res, 400, 'error', description.message);
  const category = readCategory(body.category);
  if (category.message) return fail(res, 400, 'error', category.message);

  const now = new Date().toISOString();
  const row = {
    id: randomUUID(),
    title: title.value,
    description: description.value,
    category: category.value,
    status: 'received',
    requester: member.displayName,
    requester_code: member.code,
    admin_comment: '',
    completed_at: null,
    payload_version: PAYLOAD_VERSION,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await client.from(TABLE).insert(row).select();
  if (error) return saveFailed(res, error);
  return json(res, 200, { ok: true, status: 'ok', data: toRequest(data?.[0] || row) });
}

async function updateRequest(req, res, client) {
  if (!canUseAdminWrite(req)) {
    return fail(res, 403, 'forbidden', '관리자 화면에서만 요청 상태를 바꿀 수 있습니다.');
  }

  const body = await readJsonBody(req);
  if (!isPlainObject(body)) {
    return fail(res, 400, 'error', '요청 본문이 올바르지 않습니다.');
  }

  const id = asText(body.id);
  if (!UUID_RE.test(id)) return fail(res, 400, 'error', '요청 id 가 올바르지 않습니다.');

  const hasStatus = body.status !== undefined;
  const hasComment = body.adminComment !== undefined;
  const hasTitle = body.title !== undefined;
  const hasDescription = body.description !== undefined;
  const hasCategory = body.category !== undefined;
  if (!hasStatus && !hasComment && !hasTitle && !hasDescription && !hasCategory) {
    return fail(res, 400, 'error', '바꿀 내용이 필요합니다.');
  }
  // 모르는 상태 값을 조용히 '접수'로 바꾸지 않고 거절한다.
  const status = hasStatus ? asText(body.status) : null;
  if (hasStatus && !Object.hasOwn(CSR_REQUEST_STATUS_LABELS, status)) {
    return fail(res, 400, 'error', '상태 값이 올바르지 않습니다.');
  }
  let adminComment = null;
  if (hasComment) {
    if (typeof body.adminComment !== 'string') {
      return fail(res, 400, 'error', '관리자 코멘트가 올바르지 않습니다.');
    }
    adminComment = body.adminComment.trim();
    if (adminComment.length > LIMITS.adminComment) {
      return fail(res, 400, 'error', `관리자 코멘트는 ${LIMITS.adminComment}자까지 입력할 수 있습니다.`);
    }
  }
  const content = {};
  if (hasTitle) {
    const title = readTitle(body.title);
    if (title.message) return fail(res, 400, 'error', title.message);
    content.title = title.value;
  }
  if (hasDescription) {
    const description = readDescription(body.description);
    if (description.message) return fail(res, 400, 'error', description.message);
    content.description = description.value;
  }
  if (hasCategory) {
    const category = readCategory(body.category);
    if (category.message) return fail(res, 400, 'error', category.message);
    content.category = category.value;
  }

  const { data: found, error: findError } = await client
    .from(TABLE)
    .select('id, status, completed_at')
    .eq('id', id);
  if (findError) return saveFailed(res, findError);
  const current = found?.[0];
  if (!current) return fail(res, 404, 'not-found', '요청을 찾을 수 없습니다.');

  const now = new Date().toISOString();
  const nextStatus = hasStatus ? status : current.status;
  const patch = {
    status: nextStatus,
    // 완료로 바꾸면 완료 시각을 기록(이미 있으면 유지)하고, 다른 상태가 되면 비운다.
    completed_at: nextStatus === 'done' ? current.completed_at || now : null,
    updated_at: now,
  };
  if (hasComment) patch.admin_comment = adminComment;
  Object.assign(patch, content);

  const { data, error } = await client.from(TABLE).update(patch).eq('id', id).select();
  if (error) return saveFailed(res, error);
  if (!data?.[0]) return fail(res, 404, 'not-found', '요청을 찾을 수 없습니다.');
  return json(res, 200, { ok: true, status: 'ok', data: toRequest(data[0]) });
}

async function deleteRequest(req, res, client) {
  if (!canUseAdminWrite(req)) {
    return fail(res, 403, 'forbidden', '관리자 화면에서만 요청을 삭제할 수 있습니다.');
  }

  const body = await readJsonBody(req);
  if (!isPlainObject(body)) {
    return fail(res, 400, 'error', '요청 본문이 올바르지 않습니다.');
  }
  const id = asText(body.id);
  if (!UUID_RE.test(id)) return fail(res, 400, 'error', '요청 id 가 올바르지 않습니다.');

  const { data: found, error: findError } = await client.from(TABLE).select('id').eq('id', id);
  if (findError) return saveFailed(res, findError);
  if (!found?.[0]) return fail(res, 404, 'not-found', '요청을 찾을 수 없습니다.');

  // 첨부 파일을 먼저 지운다. 버킷이 공개라서 행만 지우면 파일이 주소로 계속 열린다.
  // 파일 삭제가 실패하면 행은 남겨 두고 중단한다(다시 시도하면 정리된다).
  const bucket = client.storage.from(ATTACHMENTS_BUCKET);
  const { data: files, error: listError } = await bucket.list(id, { limit: 1000 });
  if (listError) return saveFailed(res, listError);
  const paths = (files || []).map((file) => `${id}/${file.name}`);
  if (paths.length > 0) {
    const { error: removeError } = await bucket.remove(paths);
    if (removeError) return saveFailed(res, removeError);
  }

  const { data, error } = await client.from(TABLE).delete().eq('id', id).select();
  if (error) return saveFailed(res, error);
  if (!data?.[0]) return fail(res, 404, 'not-found', '요청을 찾을 수 없습니다.');
  return json(res, 200, { ok: true, status: 'ok', data: { id, removedFiles: paths.length } });
}

export async function handleCsrRequests(req, res, client) {
  if (req.method === 'POST') return createRequest(req, res, client);
  if (req.method === 'PATCH') return updateRequest(req, res, client);
  if (req.method === 'DELETE') return deleteRequest(req, res, client);
  res.setHeader('Allow', 'POST, PATCH, DELETE');
  return fail(res, 405, 'error', 'method not allowed');
}
