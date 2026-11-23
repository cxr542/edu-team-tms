/**
 * CSR 첨부 쓰기 (service role). 읽기·다운로드는 브라우저가 anon/공개 주소로 직접 하고, 이 파일은 읽지 않는다.
 *
 * 파일 본문은 서버를 거치지 않는다(Vercel 함수 본문 한도 ~4.5MB < 첨부 10MB). 대신 두 단계로 나눈다.
 * - POST { action: 'sign' }     검사를 통과하면 경로와 1회용 업로드 토큰을 돌려준다. 브라우저가 그 토큰으로
 *                               저장소에 직접 올린다(토큰 업로드는 저장소 등록 정책이 필요 없다).
 * - POST { action: 'register' } 파일이 실제로 올라갔는지 확인하고 첨부 행을 넣는다.
 *
 * 허용 조건: 관리자 세션이 있는 /admin 요청이거나, 요청한 화면 주소의 구성원 코드가 그 CSR 요청의
 * 요청자 코드와 같을 때. 요청당 최대 5개, 파일당 10MB, 경로 형식은 서버가 정한다.
 * Origin/Referer 는 인증이 아니다. 구성원 확인은 "같은 주소에서 온 요청인지"만 보는 약한 검사다.
 */
import { randomUUID } from 'node:crypto';
import { canUseAdminWrite } from './adminWriteGuard.js';
import { readJsonBody } from './announcementEngagement.js';
import { isAllowedPublishOrigin } from './publishOrigin.js';
import { memberCodeFromReferer } from './requestScope.js';

const BUCKET = 'csr-attachments';
const REQUESTS_TABLE = 'csr_requests';
const ATTACHMENTS_TABLE = 'csr_request_attachments';
const MAX_COUNT = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_NAME = 255;
const MAX_CONTENT_TYPE = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_NAME_RE = /^[\w.\-가-힣 ]{1,150}$/;

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
  // DB·저장소 오류 문구는 로그에만 남기고, 호출자에게는 일반 문구만 돌려준다.
  console.error('[csr-attachments] failed:', error?.message || error);
  return fail(res, 500, 'error', '첨부파일을 처리하지 못했습니다.');
}

/** 화면의 sanitizeFileNameForPath 와 같은 규칙(저장소 경로에 쓸 수 없는 문자를 바꾼다). */
function sanitizeFileName(fileName) {
  const name = asText(fileName) || 'file';
  return name.replace(/[^\w.\-가-힣 ]/g, '_').slice(0, 150);
}

/** 공통 검사: 출처, 권한, 대상 요청과 기존 첨부. 통과하면 { ctx }, 아니면 응답을 이미 보낸 { done: true }. */
async function authorize(req, res, client) {
  const source = req.headers?.referer || req.headers?.origin || '';
  if (!isAllowedPublishOrigin(source)) {
    fail(res, 403, 'forbidden', '허용되지 않은 요청입니다.');
    return { done: true };
  }
  const admin = canUseAdminWrite(req);
  const refererMember = memberCodeFromReferer(req);
  if (!admin && !refererMember) {
    fail(res, 403, 'forbidden', '구성원 화면 또는 관리자 화면에서만 첨부할 수 있습니다.');
    return { done: true };
  }

  const body = await readJsonBody(req);
  if (!isPlainObject(body)) {
    fail(res, 400, 'error', '요청 본문이 올바르지 않습니다.');
    return { done: true };
  }
  const action = asText(body.action);
  if (action !== 'sign' && action !== 'register') {
    fail(res, 400, 'error', 'action 은 sign 또는 register 여야 합니다.');
    return { done: true };
  }
  const requestId = asText(body.requestId);
  if (!UUID_RE.test(requestId)) {
    fail(res, 400, 'error', '요청 id 가 올바르지 않습니다.');
    return { done: true };
  }

  const { data: found, error: findError } = await client
    .from(REQUESTS_TABLE)
    .select('id, requester_code')
    .eq('id', requestId);
  if (findError) {
    saveFailed(res, findError);
    return { done: true };
  }
  const request = found?.[0];
  if (!request) {
    fail(res, 404, 'not-found', '요청을 찾을 수 없습니다.');
    return { done: true };
  }
  if (!admin && refererMember !== String(request.requester_code || '').trim()) {
    fail(res, 403, 'forbidden', '본인 요청에만 첨부할 수 있습니다.');
    return { done: true };
  }

  const { data: existing, error: listError } = await client
    .from(ATTACHMENTS_TABLE)
    .select('id, storage_path')
    .eq('request_id', requestId);
  if (listError) {
    saveFailed(res, listError);
    return { done: true };
  }
  if ((existing || []).length >= MAX_COUNT) {
    fail(res, 409, 'conflict', `요청당 첨부파일은 최대 ${MAX_COUNT}개까지 가능합니다.`);
    return { done: true };
  }

  return { ctx: { body, action, requestId, existing: existing || [], uploader: admin ? 'admin' : refererMember } };
}

function readFileInfo(body) {
  const fileName = asText(body.fileName);
  if (!fileName || fileName.length > MAX_NAME) return { message: '파일 이름이 올바르지 않습니다.' };
  if (!Number.isInteger(body.size) || body.size <= 0) return { message: '빈 파일은 첨부할 수 없습니다.' };
  if (body.size > MAX_BYTES) return { message: '파일 1개당 최대 10MB까지 첨부할 수 있습니다.' };
  if (body.contentType !== undefined && body.contentType !== null) {
    if (typeof body.contentType !== 'string' || body.contentType.length > MAX_CONTENT_TYPE) {
      return { message: '파일 형식이 올바르지 않습니다.' };
    }
  }
  return {
    info: {
      fileName,
      size: body.size,
      contentType: asText(body.contentType) || null,
    },
  };
}

async function signUpload(res, client, ctx) {
  const parsed = readFileInfo(ctx.body);
  if (parsed.message) return fail(res, 400, 'error', parsed.message);

  const path = `${ctx.requestId}/${randomUUID()}-${sanitizeFileName(parsed.info.fileName)}`;
  const { data, error } = await client.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) return saveFailed(res, error || new Error('no upload token'));
  return json(res, 200, { ok: true, status: 'ok', data: { path, token: data.token } });
}

async function registerUpload(res, client, ctx) {
  const parsed = readFileInfo(ctx.body);
  if (parsed.message) return fail(res, 400, 'error', parsed.message);

  // 경로는 서버가 sign 에서 만든 형식(요청id/UUID-파일명)만 받는다.
  const path = asText(ctx.body.path);
  const prefix = `${ctx.requestId}/`;
  const fileKey = path.startsWith(prefix) ? path.slice(prefix.length) : '';
  const nameStart = fileKey.slice(37);
  if (!UUID_RE.test(fileKey.slice(0, 36)) || fileKey[36] !== '-' || !SAFE_NAME_RE.test(nameStart)) {
    return fail(res, 400, 'error', '첨부 경로가 올바르지 않습니다.');
  }
  if (ctx.existing.some((row) => row.storage_path === path)) {
    return fail(res, 409, 'conflict', '이미 등록된 첨부파일입니다.');
  }

  // 파일이 실제로 올라갔는지, 크기가 신고한 값과 같은지 저장소에서 확인한다.
  const { data: files, error: listError } = await client.storage
    .from(BUCKET)
    .list(ctx.requestId, { limit: 1000, search: fileKey.slice(0, 36) });
  if (listError) return saveFailed(res, listError);
  const stored = (files || []).find((file) => file.name === fileKey);
  if (!stored) return fail(res, 409, 'conflict', '업로드된 파일을 찾을 수 없습니다.');
  const storedSize = Number(stored.metadata?.size);
  if (Number.isFinite(storedSize) && storedSize !== parsed.info.size) {
    return fail(res, 409, 'conflict', '파일 크기가 일치하지 않습니다.');
  }

  const row = {
    request_id: ctx.requestId,
    file_name: parsed.info.fileName,
    storage_path: path,
    file_size_bytes: parsed.info.size,
    content_type: parsed.info.contentType,
    uploaded_by: ctx.uploader,
  };
  const { data, error } = await client.from(ATTACHMENTS_TABLE).insert(row).select();
  if (error) return saveFailed(res, error);
  return json(res, 200, { ok: true, status: 'ok', data: data?.[0] || row });
}

export async function handleCsrAttachments(req, res, client) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'error', 'method not allowed');
  }

  const auth = await authorize(req, res, client);
  if (auth.done) return undefined;
  return auth.ctx.action === 'sign' ? signUpload(res, client, auth.ctx) : registerUpload(res, client, auth.ctx);
}
