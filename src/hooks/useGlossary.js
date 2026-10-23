import { useCallback, useEffect, useState } from 'react';
import { GLOSSARY_SEED_ENTRIES } from '../data/glossarySeedEntries.js';
import {
  deleteGlossaryTermFromSupabase,
  listGlossaryTermsFromSupabase,
  normalizeGlossaryTerm,
  upsertGlossaryTermToSupabase,
  upsertGlossaryTermsToSupabase,
} from '../utils/glossarySupabase.js';

export const GLOSSARY_STORAGE_KEY = 'tms-glossary-v1';

/** 서버(Supabase) 저장이 거부·실패했을 때 사용자에게 보일 문구. 미설정(disabled)·빈 결과는 실패로 보지 않는다. */
export function describeGlossarySaveFailure(result) {
  if (!result || result.ok || result.status === 'disabled' || result.status === 'empty') return null;
  return `서버에 저장하지 못했습니다. 이 브라우저에만 반영되었습니다. (${result.message})`;
}

function loadLocalGlossary() {
  try {
    const raw = localStorage.getItem(GLOSSARY_STORAGE_KEY);
    const seeds = GLOSSARY_SEED_ENTRIES.map(normalizeGlossaryTerm).filter(Boolean);
    if (!raw) return seeds;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const existingSlugs = new Set(parsed.map((p) => p?.slug).filter(Boolean));
      const missingSeeds = seeds.filter((s) => !existingSlugs.has(s.slug));
      return [...parsed.map(normalizeGlossaryTerm).filter(Boolean), ...missingSeeds];
    }
    return seeds;
  } catch {
    return GLOSSARY_SEED_ENTRIES.map(normalizeGlossaryTerm).filter(Boolean);
  }
}

function saveLocalGlossary(terms) {
  try {
    localStorage.setItem(GLOSSARY_STORAGE_KEY, JSON.stringify(terms));
  } catch (err) {
    console.warn('Failed to save glossary to localStorage:', err);
  }
}

function sortTerms(items) {
  return [...items].sort((a, b) => a.title.localeCompare(b.title, 'ko'));
}

export function generateSlug(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || `term-${Date.now()}`;
}

export function useGlossary() {
  const [terms, setTerms] = useState(loadLocalGlossary);
  const [loading, setLoading] = useState(true);
  const [sourceStatus, setSourceStatus] = useState('local');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await listGlossaryTermsFromSupabase();

    if (result.ok && result.data && result.data.length > 0) {
      const seeds = GLOSSARY_SEED_ENTRIES.map(normalizeGlossaryTerm).filter(Boolean);
      const remoteSlugs = new Set(result.data.map((d) => d.slug));
      const missingSeeds = seeds.filter((s) => !remoteSlugs.has(s.slug));
      const merged = [...result.data, ...missingSeeds];
      const sorted = sortTerms(merged);
      setTerms(sorted);
      saveLocalGlossary(sorted);
      setSourceStatus('supabase');
    } else {
      // Fallback to local
      const local = loadLocalGlossary();
      setTerms(sortTerms(local));
      setSourceStatus(result.status === 'disabled' ? 'local' : result.status === 'empty' ? 'empty-remote' : 'local-error');
      if (!result.ok && result.status !== 'disabled' && result.status !== 'empty') {
        setError(result.message);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createTerm = useCallback(async (draft) => {
    setSaving(true);
    setError(null);
    try {
      const slug = draft.slug ? draft.slug.trim().toLowerCase() : generateSlug(draft.title);
      const normalized = normalizeGlossaryTerm({
        ...draft,
        slug,
        id: slug,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (!normalized || !normalized.title) {
        throw new Error('용어 제목은 필수입니다.');
      }

      // Check duplicate slug in current terms
      if (terms.some((t) => t.slug === normalized.slug)) {
        throw new Error(`이미 존재하는 식별자(Slug: ${normalized.slug})입니다.`);
      }

      // Attempt Supabase save
      const supabaseResult = await upsertGlossaryTermToSupabase(normalized);
      const createWarning = describeGlossarySaveFailure(supabaseResult);
      if (createWarning) setError(createWarning);

      // Local update
      setTerms((prev) => {
        const next = sortTerms([...prev, normalized]);
        saveLocalGlossary(next);
        return next;
      });

      return { ok: true, data: normalized, supabase: supabaseResult.ok };
    } catch (err) {
      const message = err instanceof Error ? err.message : '용어 등록 실패';
      setError(message);
      return { ok: false, message };
    } finally {
      setSaving(false);
    }
  }, [terms]);

  const updateTerm = useCallback(async (slug, patch) => {
    setSaving(true);
    setError(null);
    try {
      const target = terms.find((t) => t.slug === slug);
      if (!target) {
        throw new Error('수정할 용어를 찾지 못했습니다.');
      }

      const updated = normalizeGlossaryTerm({
        ...target,
        ...patch,
        slug: target.slug, // keep slug immutable
        id: target.id,
        updatedAt: new Date().toISOString(),
      });

      // Attempt Supabase save
      const supabaseResult = await upsertGlossaryTermToSupabase(updated);
      const updateWarning = describeGlossarySaveFailure(supabaseResult);
      if (updateWarning) setError(updateWarning);

      // Local update
      setTerms((prev) => {
        const next = sortTerms(prev.map((t) => (t.slug === slug ? updated : t)));
        saveLocalGlossary(next);
        return next;
      });

      return { ok: true, data: updated, supabase: supabaseResult.ok };
    } catch (err) {
      const message = err instanceof Error ? err.message : '용어 수정 실패';
      setError(message);
      return { ok: false, message };
    } finally {
      setSaving(false);
    }
  }, [terms]);

  const deleteTerm = useCallback(async (slug) => {
    setSaving(true);
    setError(null);
    try {
      const deleteResult = await deleteGlossaryTermFromSupabase(slug);
      const deleteWarning = describeGlossarySaveFailure(deleteResult);
      if (deleteWarning) setError(deleteWarning);

      setTerms((prev) => {
        const next = prev.filter((t) => t.slug !== slug);
        saveLocalGlossary(next);
        return next;
      });

      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : '용어 삭제 실패';
      setError(message);
      return { ok: false, message };
    } finally {
      setSaving(false);
    }
  }, []);

  const resetToSeed = useCallback(async () => {
    const seed = GLOSSARY_SEED_ENTRIES.map(normalizeGlossaryTerm).filter(Boolean);
    setTerms(sortTerms(seed));
    saveLocalGlossary(seed);
    // Push seed items to Supabase if connected (서버 한도에 맞춰 200건씩)
    let warning = null;
    for (let i = 0; i < seed.length; i += 200) {
      const res = await upsertGlossaryTermsToSupabase(seed.slice(i, i + 200));
      warning = warning || describeGlossarySaveFailure(res);
    }
    if (warning) setError(warning);
    return { ok: true, count: seed.length };
  }, []);

  return {
    terms,
    loading,
    saving,
    error,
    sourceStatus,
    refresh,
    createTerm,
    updateTerm,
    deleteTerm,
    resetToSeed,
  };
}
