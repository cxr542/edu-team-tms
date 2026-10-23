/**
 * 용어사전 행 ↔ 용어 객체 변환 (순수 함수 — 브라우저·서버 공용).
 * 실제 운영 컬럼: id, title, slug, category, tags, summary, source, related_terms, markdown, created_at, updated_at.
 * `source` 에는 null 을 보내지 않는다(NOT NULL).
 */
function nowIso() {
  return new Date().toISOString();
}

export function normalizeGlossaryTerm(row) {
  if (!row || typeof row !== 'object') return null;
  const slug = String(row.slug || row.id || '').trim();
  if (!slug) return null;

  const rawTags = row.tags;
  let tags = [];
  if (Array.isArray(rawTags)) {
    tags = rawTags.map(String).filter(Boolean);
  } else if (typeof rawTags === 'string') {
    try {
      const parsed = JSON.parse(rawTags);
      tags = Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [rawTags];
    } catch {
      tags = rawTags.split(',').map((t) => t.trim()).filter(Boolean);
    }
  }

  const rawRelated = row.related_terms ?? row.related;
  let related = [];
  if (Array.isArray(rawRelated)) {
    related = rawRelated.map((r) => (typeof r === 'object' && r?.slug ? r.slug : String(r))).filter(Boolean);
  } else if (typeof rawRelated === 'string') {
    try {
      const parsed = JSON.parse(rawRelated);
      related = Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [rawRelated];
    } catch {
      related = rawRelated.split(',').map((r) => r.trim()).filter(Boolean);
    }
  }

  return {
    id: String(row.id || slug).trim(),
    slug,
    title: String(row.title || '').trim(),
    category: String(row.category || 'topic').trim() || 'topic',
    tags,
    sourceUrl: row.source || row.source_url || row.sourceUrl || null,
    body: row.markdown || row.body || row.summary || '',
    related,
    visibility: String(row.visibility || 'published').trim(),
    author: row.author ? String(row.author).trim() : null,
    authorCode: row.author_code || row.authorCode || null,
    createdAt: row.created_at || row.createdAt || nowIso(),
    updatedAt: row.updated_at || row.updatedAt || nowIso(),
  };
}

export function toRowPayload(term) {
  const norm = normalizeGlossaryTerm(term);
  if (!norm) return null;
  return {
    id: norm.id,
    slug: norm.slug,
    title: norm.title,
    category: norm.category,
    tags: norm.tags,
    source: norm.sourceUrl || '',
    markdown: norm.body,
    related_terms: norm.related,
    updated_at: nowIso(),
  };
}

