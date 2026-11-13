import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_NAV_LABELS, NAV_LABELS_STORAGE_KEY } from '../constants/navLabels';

const LEGACY_LEDGER_LABEL = '월별 지출 장부';

function loadNavLabels() {
  try {
    const raw = localStorage.getItem(NAV_LABELS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NAV_LABELS };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed['idea-bank'] && !parsed.csr) {
      parsed.csr = parsed['idea-bank'];
      delete parsed['idea-bank'];
    }
    const merged = { ...DEFAULT_NAV_LABELS, ...parsed };
    if (merged.ledger === LEGACY_LEDGER_LABEL) {
      merged.ledger = DEFAULT_NAV_LABELS.ledger;
    }
    delete merged['idea-bank'];
    return merged;
  } catch {
    return { ...DEFAULT_NAV_LABELS };
  }
}

export function useNavLabels() {
  const [labels, setLabels] = useState(loadNavLabels);

  useEffect(() => {
    localStorage.setItem(NAV_LABELS_STORAGE_KEY, JSON.stringify(labels));
  }, [labels]);

  const updateLabel = useCallback((id, value) => {
    const trimmed = String(value).trim();
    if (!trimmed) return;
    setLabels((prev) => ({ ...prev, [id]: trimmed }));
  }, []);

  const resetLabels = useCallback(() => {
    setLabels({ ...DEFAULT_NAV_LABELS });
  }, []);

  /** 팀 공유 저장소에서 읽은 이름으로 통째로 바꾼다 (기본 이름 위에 덮어쓴다) */
  const replaceLabels = useCallback((next) => {
    setLabels({ ...DEFAULT_NAV_LABELS, ...(next || {}) });
  }, []);

  return { labels, updateLabel, resetLabels, replaceLabels, defaults: DEFAULT_NAV_LABELS };
}
