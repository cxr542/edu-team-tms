async function parseJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * @param {string[]} announcementIds
 * @param {string} [memberCode]
 */
export async function fetchAnnouncementReactions(announcementIds, memberCode) {
  const ids = (announcementIds || []).filter(Boolean);
  if (ids.length === 0) {
    return { ok: true, data: {} };
  }
  const params = new URLSearchParams({
    announcementIds: ids.join(','),
  });
  if (memberCode) params.set('memberCode', memberCode);

  const res = await fetch(`/api/announcement-reactions?${params}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const body = await parseJson(res);
  if (!res.ok || !body?.ok) {
    return {
      ok: false,
      message: body?.message || `Reactions API error (${res.status})`,
      data: {},
    };
  }
  return { ok: true, data: body.data || {} };
}

/**
 * @param {{ announcementId: string, memberCode: string, emoji: string }} payload
 */
export async function toggleAnnouncementReaction(payload) {
  const res = await fetch('/api/announcement-reactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await parseJson(res);
  if (!res.ok || !body?.ok) {
    return {
      ok: false,
      message: body?.message || `Reaction toggle failed (${res.status})`,
    };
  }
  return { ok: true, data: body.data || {}, toggledOff: Boolean(body.toggledOff) };
}

export async function fetchAnnouncementComments(announcementId) {
  const params = new URLSearchParams({ announcementId: String(announcementId || '') });
  const res = await fetch(`/api/announcement-comments?${params}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const body = await parseJson(res);
  if (!res.ok || !body?.ok) {
    return {
      ok: false,
      message: body?.message || `Comments API error (${res.status})`,
      data: [],
    };
  }
  return { ok: true, data: Array.isArray(body.data) ? body.data : [] };
}

export async function createAnnouncementComment(payload) {
  const res = await fetch('/api/announcement-comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await parseJson(res);
  if (!res.ok || !body?.ok) {
    return {
      ok: false,
      message: body?.message || `Comment create failed (${res.status})`,
    };
  }
  return { ok: true, data: body.data };
}

export async function deleteAnnouncementComment({ commentId, memberCode }) {
  const res = await fetch('/api/announcement-comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ action: 'delete', commentId, memberCode }),
  });
  const body = await parseJson(res);
  if (!res.ok || !body?.ok) {
    return {
      ok: false,
      message: body?.message || `Comment delete failed (${res.status})`,
    };
  }
  return { ok: true, data: body.data };
}
