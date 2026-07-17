/**
 * Confluence Cloud (강의일지) read helpers — server-only.
 */

export const DEFAULT_CONFLUENCE_BASE_URL = 'https://okestro.atlassian.net';
export const DEFAULT_CONFLUENCE_SPACE_KEY = 'rDzwjbV6p8qL';
/** Phase 0 confirmed: 「02. 강의일지 폴더」 */
export const DEFAULT_LECTURE_FOLDER_ID = '1867843025';

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
export function resolveConfluenceConfig(env = process.env) {
  const baseUrl = String(env.CONFLUENCE_BASE_URL || DEFAULT_CONFLUENCE_BASE_URL)
    .trim()
    .replace(/\/$/, '');
  const email = String(env.CONFLUENCE_EMAIL || '').trim();
  const apiToken = String(env.CONFLUENCE_API_TOKEN || '').trim();
  const folderId = String(
    env.CONFLUENCE_LECTURE_FOLDER_ID || DEFAULT_LECTURE_FOLDER_ID
  ).trim();
  const parentType = String(env.CONFLUENCE_LECTURE_PARENT_TYPE || 'folder')
    .trim()
    .toLowerCase();
  const spaceKey = String(env.CONFLUENCE_SPACE_KEY || DEFAULT_CONFLUENCE_SPACE_KEY).trim();

  const configured = Boolean(email && apiToken && folderId);
  return {
    baseUrl,
    email,
    apiToken,
    folderId,
    parentType: parentType === 'page' ? 'page' : 'folder',
    spaceKey,
    configured,
  };
}

/** @param {string} email @param {string} apiToken */
export function buildBasicAuthHeader(email, apiToken) {
  const raw = `${email}:${apiToken}`;
  const encoded =
    typeof Buffer !== 'undefined'
      ? Buffer.from(raw, 'utf8').toString('base64')
      : btoa(raw);
  return `Basic ${encoded}`;
}

/**
 * @param {{ baseUrl: string, spaceKey: string, type: string, id: string }} opts
 */
export function buildWebUiUrl({ baseUrl, spaceKey, type, id }) {
  const root = `${baseUrl.replace(/\/$/, '')}/wiki/spaces/${encodeURIComponent(spaceKey)}`;
  if (type === 'page') return `${root}/pages/${id}`;
  if (type === 'folder') return `${root}/folder/${id}`;
  return `${root}`;
}

/** @param {unknown} raw */
export function sanitizeContentId(raw) {
  const id = String(raw ?? '').trim();
  if (!/^\d{1,20}$/.test(id)) return '';
  return id;
}

/**
 * Ensure ad-hoc parentId requests stay inside the configured lecture root.
 * @param {{
 *   config: ReturnType<typeof resolveConfluenceConfig>,
 *   parentId: string,
 *   parentType: 'folder' | 'page',
 *   fetchImpl?: typeof fetch,
 * }} opts
 */
export async function assertContentInLectureScope({
  config,
  parentId,
  parentType,
  fetchImpl = fetch,
}) {
  const id = sanitizeContentId(parentId);
  const rootId = sanitizeContentId(config.folderId);
  if (!id || !rootId) {
    const err = new Error('Invalid parentId');
    err.status = 400;
    throw err;
  }
  if (id === rootId) return;

  const kind = parentType === 'page' ? 'page' : 'folder';
  const path =
    kind === 'page'
      ? `/wiki/api/v2/pages/${id}/ancestors`
      : `/wiki/api/v2/folders/${id}/ancestors`;
  const url = new URL(path, `${config.baseUrl}/`);
  url.searchParams.set('limit', '250');

  const upstream = await fetchImpl(url.toString(), {
    headers: {
      Authorization: buildBasicAuthHeader(config.email, config.apiToken),
      Accept: 'application/json',
    },
  });

  const text = await upstream.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!upstream.ok) {
    const message =
      (data && (data.message || data.errorMessage || data.error)) ||
      `Confluence API error (${upstream.status})`;
    const err = new Error(String(message));
    err.status = upstream.status;
    err.upstream = data;
    throw err;
  }

  const ancestors = Array.isArray(data?.results) ? data.results : [];
  const isInScope = ancestors.some((row) => String(row?.id ?? '').trim() === rootId);
  if (!isInScope) {
    const err = new Error('Requested Confluence parent is outside the lecture journal root.');
    err.status = 403;
    throw err;
  }
}

/**
 * @param {Record<string, unknown>} item
 * @param {{ baseUrl: string, spaceKey: string }} ctx
 */
export function normalizeChildItem(item, ctx) {
  const id = String(item?.id ?? '').trim();
  const type = String(item?.type ?? '').trim().toLowerCase() || 'page';
  const title = String(item?.title ?? '').trim() || '(제목 없음)';
  const status = String(item?.status ?? '').trim() || 'current';
  return {
    id,
    type,
    title,
    status,
    childPosition: item?.childPosition ?? null,
    webUi: id ? buildWebUiUrl({ ...ctx, type, id }) : '',
  };
}

/**
 * @param {{
 *   config: ReturnType<typeof resolveConfluenceConfig>,
 *   parentId: string,
 *   parentType: 'folder' | 'page',
 *   limit?: number,
 *   fetchImpl?: typeof fetch,
 * }} opts
 */
export async function fetchDirectChildren({
  config,
  parentId,
  parentType,
  limit = 50,
  fetchImpl = fetch,
}) {
  const id = sanitizeContentId(parentId);
  if (!id) {
    const err = new Error('Invalid parentId');
    err.status = 400;
    throw err;
  }
  const kind = parentType === 'page' ? 'page' : 'folder';
  const path =
    kind === 'page'
      ? `/wiki/api/v2/pages/${id}/direct-children`
      : `/wiki/api/v2/folders/${id}/direct-children`;
  const url = new URL(path, `${config.baseUrl}/`);
  url.searchParams.set('limit', String(Math.min(Math.max(limit, 1), 250)));

  const upstream = await fetchImpl(url.toString(), {
    headers: {
      Authorization: buildBasicAuthHeader(config.email, config.apiToken),
      Accept: 'application/json',
    },
  });

  const text = await upstream.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!upstream.ok) {
    const message =
      (data && (data.message || data.errorMessage || data.error)) ||
      `Confluence API error (${upstream.status})`;
    const err = new Error(String(message));
    err.status = upstream.status;
    err.upstream = data;
    throw err;
  }

  const results = Array.isArray(data?.results) ? data.results : [];
  const ctx = { baseUrl: config.baseUrl, spaceKey: config.spaceKey };
  return {
    parentId: id,
    parentType: kind,
    items: results.map((row) => normalizeChildItem(row, ctx)),
  };
}
