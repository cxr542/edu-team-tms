import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';

export const GLOSSARY_TABLE = 'glossary_terms';

function result({ ok, status, message, data = null }) {
  return { ok, status, message, data };
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function nowIso() {
  return new Date().toISOString();
}

function supabaseDisabledResult() {
  return result({
    ok: false,
    status: 'disabled',
    message: 'Supabase is not configured.',
  });
}

function unexpectedErrorResult(error, operation) {
  return result({
    ok: false,
    status: 'error',
    message:
      error instanceof Error ? error.message : `Unknown Supabase glossary ${operation} error.`,
  });
}

function isConfigured() {
  if (!isSupabaseConfigured) return false;
  return Boolean(getSupabaseClient());
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

  const rawRelated = row.related;
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
    sourceUrl: row.source_url || row.sourceUrl || null,
    body: typeof row.body === 'string' ? row.body : '',
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
    source_url: norm.sourceUrl,
    body: norm.body,
    related: norm.related,
    visibility: norm.visibility,
    author: norm.author,
    author_code: norm.authorCode,
    updated_at: nowIso(),
  };
}

export async function listGlossaryTermsFromSupabase() {
  if (!isConfigured()) return supabaseDisabledResult();

  const client = getSupabaseClient();
  if (!client) return supabaseDisabledResult();

  try {
    const { data, error } = await client
      .from(GLOSSARY_TABLE)
      .select('*')
      .order('title', { ascending: true });

    if (error) {
      return result({ ok: false, status: 'error', message: error.message });
    }

    if (!data || data.length === 0) {
      return result({ ok: true, status: 'empty', message: 'No glossary terms in Supabase.', data: [] });
    }

    const items = data.map(normalizeGlossaryTerm).filter(Boolean);
    return result({
      ok: true,
      status: 'ok',
      message: 'Glossary terms loaded from Supabase.',
      data: items,
    });
  } catch (error) {
    return unexpectedErrorResult(error, 'list');
  }
}

export async function upsertGlossaryTermToSupabase(term) {
  if (!isConfigured()) return supabaseDisabledResult();

  const client = getSupabaseClient();
  if (!client) return supabaseDisabledResult();

  try {
    const payload = toRowPayload(term);
    if (!payload || !hasText(payload.slug) || !hasText(payload.title)) {
      return result({ ok: false, status: 'error', message: 'Title and slug are required.' });
    }

    const { data, error } = await client
      .from(GLOSSARY_TABLE)
      .upsert(payload, { onConflict: 'slug' })
      .select();

    if (error) {
      return result({ ok: false, status: 'error', message: error.message });
    }

    const saved = data && data[0] ? normalizeGlossaryTerm(data[0]) : normalizeGlossaryTerm(payload);
    return result({
      ok: true,
      status: 'ok',
      message: 'Term saved to Supabase.',
      data: saved,
    });
  } catch (error) {
    return unexpectedErrorResult(error, 'save');
  }
}

export async function deleteGlossaryTermFromSupabase(slug) {
  if (!isConfigured()) return supabaseDisabledResult();

  const client = getSupabaseClient();
  if (!client) return supabaseDisabledResult();

  try {
    const { error } = await client
      .from(GLOSSARY_TABLE)
      .delete()
      .eq('slug', slug);

    if (error) {
      return result({ ok: false, status: 'error', message: error.message });
    }

    return result({
      ok: true,
      status: 'ok',
      message: 'Term deleted from Supabase.',
      data: { slug },
    });
  } catch (error) {
    return unexpectedErrorResult(error, 'delete');
  }
}
