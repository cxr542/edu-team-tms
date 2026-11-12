import { describe, expect, it } from 'vitest';
import { filterDocsByQuery, normalizeCategory, normalizeTags } from '../src/utils/referenceDocSearch.js';

describe('referenceDocSearch', () => {
  it('normalizeCategory: 모르는 값은 lecture', () => {
    expect(normalizeCategory('research')).toBe('research');
    expect(normalizeCategory('ops')).toBe('lecture');
    expect(normalizeCategory(undefined)).toBe('lecture');
  });

  it('normalizeTags: 쉼표·줄바꿈 구분, # 제거, 중복(대소문자) 제거, 개수·길이 제한', () => {
    expect(normalizeTags('기술 조사, #경쟁사,경쟁사 ,\nAWS, aws')).toEqual(['기술 조사', '경쟁사', 'AWS']);
    expect(normalizeTags(['a', '', null, 'b'])).toEqual(['a', 'b']);
    expect(normalizeTags(Array.from({ length: 12 }, (_, i) => `t${i}`))).toHaveLength(8);
    expect(normalizeTags('x'.repeat(40))[0]).toHaveLength(20);
    expect(normalizeTags(undefined)).toEqual([]);
  });

  it('filterDocsByQuery: 제목·요약·태그·그룹에서 모든 단어가 맞아야 남는다', () => {
    const docs = [
      { id: 1, title: 'Kubernetes 네트워크 조사', summary: '', tags: ['CNI'] },
      { id: 2, title: '로드밸런서 생성', summary: 'CONTRABASS', group: 'CONTRABASS 3.0.6' },
    ];
    expect(filterDocsByQuery(docs, '')).toHaveLength(2);
    expect(filterDocsByQuery(docs, 'cni').map((d) => d.id)).toEqual([1]);
    expect(filterDocsByQuery(docs, '3.0.6 로드').map((d) => d.id)).toEqual([2]);
    expect(filterDocsByQuery(docs, '로드 CNI')).toHaveLength(0);
  });
});
