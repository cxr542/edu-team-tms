/**
 * Collect unique task titles from a member's journal days map.
 * @param {Record<string, { tasks?: { title?: string }[] }> | null | undefined} memberDays
 * @returns {string[]}
 */
export function collectJournalTaskTitles(memberDays) {
  const seen = new Set();
  const titles = [];
  for (const day of Object.values(memberDays || {})) {
    for (const task of day?.tasks || []) {
      const title = String(task?.title || '').trim();
      if (!title || seen.has(title)) continue;
      seen.add(title);
      titles.push(title);
    }
  }
  titles.sort((a, b) => a.localeCompare(b, 'ko'));
  return titles;
}

/**
 * Filter title suggestions for combobox (prefix matches first).
 * @param {string[]} titles
 * @param {string} query
 * @param {{ limit?: number, hideExact?: boolean }} [opts]
 * @returns {string[]}
 */
export function filterJournalTaskTitleSuggestions(titles, query, opts = {}) {
  const limit = opts.limit ?? 10;
  const hideExact = opts.hideExact !== false;
  const list = Array.isArray(titles) ? titles : [];
  const q = String(query || '').trim().toLowerCase();

  if (!q) {
    return list.slice(0, limit);
  }

  const starts = [];
  const includes = [];
  for (const title of list) {
    const lower = title.toLowerCase();
    if (hideExact && lower === q) continue;
    if (lower.startsWith(q)) starts.push(title);
    else if (lower.includes(q)) includes.push(title);
  }
  return [...starts, ...includes].slice(0, limit);
}
