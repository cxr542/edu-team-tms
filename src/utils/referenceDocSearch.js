/** 문서 종류(업로드·제출 공통). 'lecture' 는 기존 강의 가이드, 새 종류는 여기에만 더한다. */
export const UPLOAD_CATEGORIES = ['lecture', 'research'];

/** 리서치 자료는 제품 버전 그룹이 없어 DB 의 grp(not null) 에 이 값을 넣는다. */
export const RESEARCH_GROUP = '리서치 자료';

export const MAX_TAGS = 8;
export const MAX_TAG_LENGTH = 20;

export const normalizeCategory = (value) => (UPLOAD_CATEGORIES.includes(value) ? value : 'lecture');

/** 쉼표·공백 구분 문자열 또는 배열 → 중복 없는 태그 배열 (개수·길이 제한). */
export function normalizeTags(input) {
  const list = Array.isArray(input) ? input : String(input ?? '').split(/[,\n]/);
  const out = [];
  for (const raw of list) {
    const tag = String(raw ?? '').trim().replace(/^#/, '').slice(0, MAX_TAG_LENGTH);
    if (tag && !out.some((t) => t.toLowerCase() === tag.toLowerCase())) out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/** 제목·요약·태그·그룹에서 검색어(공백으로 나눈 단어 모두) 가 들어 있는 문서만 남긴다. */
export function filterDocsByQuery(docs, query) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return docs;
  return docs.filter((d) => {
    const hay = [d.title, d.summary, d.group, ...(d.tags || [])].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
