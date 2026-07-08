import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';
import { lockAdminGate } from '../constants/adminGate.js';
import {
  countRecentAnnouncementUpdates,
  formatAnnouncementCategoryLabel,
  normalizeAnnouncementCategory,
  sortAnnouncements,
} from '../constants/announcements.js';

const ANNOUNCEMENTS_TABLE = 'announcements';

function result({ ok, status, message, data = null }) {
  return { ok, status, message, data };
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function readAuthorCode(row) {
  if (!row || typeof row !== 'object') return '';
  return String(row.author_code || row.authorCode || '').trim();
}

function readBoolean(row, snakeKey, camelKey) {
  if (!row || typeof row !== 'object') return false;
  if (typeof row[snakeKey] === 'boolean') return row[snakeKey];
  if (typeof row[camelKey] === 'boolean') return row[camelKey];
  return false;
}

function nowIso() {
  return new Date().toISOString();
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
      error instanceof Error ? error.message : `Unknown Supabase announcements ${operation} error.`,
  });
}

function isConfigured() {
  if (!isSupabaseConfigured) return false;
  return Boolean(getSupabaseClient());
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `announcement-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeAnnouncement(row) {
  if (!row || typeof row !== 'object') return null;
  const category = normalizeAnnouncementCategory(row.category);
  const isPublished = readBoolean(row, 'is_published', 'isPublished');
  const isPinned = readBoolean(row, 'is_pinned', 'isPinned');
  const publishedAt = row.published_at || row.publishedAt || null;
  return {
    id: String(row.id || '').trim(),
    title: String(row.title || '').trim(),
    body: typeof row.body === 'string' ? row.body.trim() : '',
    category,
    isPinned,
    isPublished,
    author: String(row.author || '').trim(),
    authorCode: readAuthorCode(row),
    publishedAt,
    updatedAt: row.updated_at || row.updatedAt || null,
    createdAt: row.created_at || row.createdAt || null,
    categoryLabel: formatAnnouncementCategoryLabel(category),
  };
}

export function buildAnnouncementDraft({
  title,
  body,
  category,
  author,
  authorCode,
  isPinned = false,
  isPublished = false,
  publishedAt = null,
} = {}) {
  const normalizedTitle = String(title || '').trim();
  if (!normalizedTitle) {
    return { ok: false, status: 'error', message: 'title is required.' };
  }

  const normalizedBody = String(body || '').trim();
  if (!normalizedBody) {
    return { ok: false, status: 'error', message: 'body is required.' };
  }

  const normalizedAuthor = String(author || '').trim();
  if (!normalizedAuthor) {
    return { ok: false, status: 'error', message: 'author is required.' };
  }

  const normalizedAuthorCode = String(authorCode || '').trim();
  if (!normalizedAuthorCode) {
    return { ok: false, status: 'error', message: 'authorCode is required.' };
  }

  const createdAt = nowIso();
  const normalizedCategory = normalizeAnnouncementCategory(category);
  const publishedStamp = isPublished ? (publishedAt || createdAt) : publishedAt || null;

  return {
    ok: true,
    status: 'ok',
    message: 'Announcement draft created.',
    data: {
      id: randomId(),
      title: normalizedTitle,
      body: normalizedBody,
      category: normalizedCategory,
      isPinned: Boolean(isPinned),
      isPublished: Boolean(isPublished),
      author: normalizedAuthor,
      authorCode: normalizedAuthorCode,
      publishedAt: publishedStamp,
      createdAt,
      updatedAt: createdAt,
    },
  };
}

async function callAnnouncementsApi(path, { method = 'GET', announcement = null } = {}) {
  try {
    const response = await fetch(path, {
      method,
      headers: announcement ? { 'Content-Type': 'application/json' } : undefined,
      credentials: 'include',
      body: announcement ? JSON.stringify({ announcement }) : undefined,
    });
    const payload = await response.json().catch(() => ({}));

    if (response.status === 403) {
      lockAdminGate();
      return result({
        ok: false,
        status: 'forbidden',
        message:
          payload.message ||
          '관리자 세션이 만료되었습니다. /admin 에서 비밀번호를 다시 입력하세요.',
      });
    }

    if (!response.ok) {
      return result({
        ok: false,
        status: payload.status || 'error',
        message: payload.message || `Announcements API failed (${response.status}).`,
      });
    }

    return result({
      ok: true,
      status: payload.status || 'ok',
      message: payload.message || 'Announcements API succeeded.',
      data: payload.data ?? null,
    });
  } catch (error) {
    return unexpectedErrorResult(error, 'api');
  }
}

export async function upsertAnnouncementToSupabase(announcement) {
  if (!announcement || typeof announcement !== 'object') {
    return result({ ok: false, status: 'error', message: 'announcement is required.' });
  }
  if (!hasText(announcement.title)) {
    return result({ ok: false, status: 'error', message: 'title is required.' });
  }
  if (!hasText(announcement.body)) {
    return result({ ok: false, status: 'error', message: 'body is required.' });
  }
  if (!hasText(announcement.author)) {
    return result({ ok: false, status: 'error', message: 'author is required.' });
  }
  if (!hasText(announcement.authorCode)) {
    return result({ ok: false, status: 'error', message: 'authorCode is required.' });
  }
  if (!isConfigured()) return supabaseDisabledResult();

  try {
    const normalized = normalizeAnnouncement(announcement);
    if (!normalized) {
      return result({ ok: false, status: 'error', message: 'Announcement payload is invalid.' });
    }
    return await callAnnouncementsApi('/api/announcements', {
      method: 'POST',
      announcement: normalized,
    });
  } catch (error) {
    return unexpectedErrorResult(error, 'save');
  }
}

export async function listAnnouncementsFromSupabase({ includeUnpublished = false } = {}) {
  if (!isConfigured()) return supabaseDisabledResult();

  if (includeUnpublished) {
    return callAnnouncementsApi('/api/announcements?includeUnpublished=true');
  }

  const client = getSupabaseClient();
  if (!client) return supabaseDisabledResult();

  try {
    let query = client
      .from(ANNOUNCEMENTS_TABLE)
      .select(
        'id, title, body, category, is_pinned, is_published, author, author_code, published_at, created_at, updated_at, payload_version'
      )
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (!includeUnpublished) {
      query = query.eq('is_published', true);
    }

    const { data, error } = await query;

    if (error) {
      return result({ ok: false, status: 'error', message: error.message });
    }

    if (!data || data.length === 0) {
      return result({ ok: true, status: 'empty', message: 'Announcements were not found.', data: [] });
    }

    const normalized = data.map(normalizeAnnouncement).filter(Boolean);
    return result({
      ok: true,
      status: 'ok',
      message: 'Announcements loaded from Supabase.',
      data: sortAnnouncements(normalized),
    });
  } catch (error) {
    return unexpectedErrorResult(error, 'read');
  }
}

export async function updateAnnouncementInSupabase({ announcement, id, patch = {} } = {}) {
  if (!announcement || typeof announcement !== 'object') {
    return result({ ok: false, status: 'error', message: 'announcement is required.' });
  }

  const current = normalizeAnnouncement(announcement);
  if (!current) {
    return result({ ok: false, status: 'error', message: 'announcement is invalid.' });
  }

  const nextIsPublished =
    typeof patch.isPublished === 'boolean' ? patch.isPublished : current.isPublished;
  const nextPublishedAt =
    nextIsPublished
      ? current.publishedAt || patch.publishedAt || nowIso()
      : current.publishedAt || patch.publishedAt || null;

  const merged = {
    ...current,
    ...patch,
    id: String(id || current.id || '').trim(),
    title: String(patch.title ?? current.title ?? '').trim(),
    body: String(patch.body ?? current.body ?? '').trim(),
    category: normalizeAnnouncementCategory(patch.category ?? current.category),
    isPinned: typeof patch.isPinned === 'boolean' ? patch.isPinned : current.isPinned,
    isPublished: nextIsPublished,
    author: String(current.author || '').trim(),
    authorCode: String(current.authorCode || '').trim(),
    publishedAt: nextPublishedAt,
    createdAt: current.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  return upsertAnnouncementToSupabase(merged);
}

export function buildAnnouncementSummary(announcements) {
  const published = announcements.filter((item) => item.isPublished);
  return {
    totalPublished: published.length,
    pinnedPublished: published.filter((item) => item.isPinned).length,
    recentPublished: countRecentAnnouncementUpdates(published),
  };
}
