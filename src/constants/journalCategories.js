export const JOURNAL_CATS = {
  edu: { label: '교육', color: '#38bdf8' },
  prep: { label: '교육 준비', color: '#a78bfa' },
  ai: { label: 'AI', color: '#f472b6' },
  other: { label: '기타', color: '#94a3b8' },
};

export const JOURNAL_CAT_ORDER = ['edu', 'prep', 'ai', 'other'];

export const WEEK_CAT_BULLET = '• ';

export const WEEK_COLUMN_TEMPLATE = `• 교육
└ 
• 교육 준비
└ 
• AI
└ 
• 기타
└`;

/** 예전 자동 초안(삭제된 기능) — 템플릿으로 되돌림 */
const LEGACY_AUTO_DRAFT_RE = /\[주간 M\/M\]|\[요일별\]|\[카테고리별\]/;

/** 금주(요약)·차주(예정) — 비어 있거나 예전 초안이면 구성원/공통 템플릿 */
export function resolveWeekColumnText(saved, template = WEEK_COLUMN_TEMPLATE) {
  const text = typeof saved === 'string' ? saved : '';
  const tpl = typeof template === 'string' && template.trim() ? template : WEEK_COLUMN_TEMPLATE;
  if (!text.trim() || LEGACY_AUTO_DRAFT_RE.test(text)) {
    return tpl;
  }
  return text;
}

/** 저장소에서 예전 초안 키만 제거(템플릿이 UI에 보이도록) */
export function stripLegacyWeekColumnEntries(map) {
  if (!map || typeof map !== 'object') return {};
  const next = { ...map };
  Object.keys(next).forEach((key) => {
    const val = next[key];
    if (typeof val === 'string' && LEGACY_AUTO_DRAFT_RE.test(val)) {
      delete next[key];
    }
  });
  return next;
}
