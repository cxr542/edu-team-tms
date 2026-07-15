/**
 * Client helper for Confluence lecture-journal list proxy.
 * @param {{ parentId?: string, parentType?: 'folder' | 'page' }} [opts]
 */
export async function fetchLectureJournalChildren(opts = {}) {
  const params = new URLSearchParams({ action: 'list' });
  if (opts.parentId) params.set('parentId', String(opts.parentId));
  if (opts.parentType) params.set('parentType', String(opts.parentType));

  const res = await fetch(`/api/confluence-lecture?${params}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    return {
      available: false,
      items: [],
      error:
        data?.message ||
        data?.error ||
        `강의일지 API 오류 (${res.status})`,
      status: res.status,
    };
  }

  return {
    available: Boolean(data?.available),
    items: Array.isArray(data?.items) ? data.items : [],
    parentId: data?.parentId || opts.parentId || '',
    parentType: data?.parentType || opts.parentType || 'folder',
    rootFolderId: data?.rootFolderId || '',
    spaceKey: data?.spaceKey || '',
    baseUrl: data?.baseUrl || '',
    message: data?.message || '',
    error: data?.error || '',
    status: res.status,
  };
}
