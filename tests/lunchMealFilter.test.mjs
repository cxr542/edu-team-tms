import { describe, expect, it } from 'vitest';
import { isLunchMealPlace, LUNCH_KAKAO_QUERIES } from '../src/utils/lunchKakaoApi.js';

describe('isLunchMealPlace', () => {
  it('빵집·디저트·카페·술집은 뺀다', () => {
    for (const categoryPath of [
      '음식점 > 간식 > 제과,베이커리',
      '음식점 > 간식 > 아이스크림',
      '음식점 > 카페 > 디저트카페',
      '음식점 > 간식 > 떡,한과',
      '음식점 > 술집 > 호프,요리주점',
      '음식점 > 술집 > 와인바',
    ]) {
      expect(isLunchMealPlace({ categoryPath })).toBe(false);
    }
  });

  it('식사 가게는 남긴다(분류 끝 이름만 있어도)', () => {
    for (const categoryPath of ['음식점 > 한식 > 국밥', '음식점 > 중식 > 중국요리', '음식점 > 일식 > 돈까스,우동', '음식점 > 분식']) {
      expect(isLunchMealPlace({ categoryPath })).toBe(true);
    }
    expect(isLunchMealPlace({ category: '칼국수' })).toBe(true);
    expect(isLunchMealPlace({ category: '제과,베이커리' })).toBe(false);
  });

  it('점심 검색어가 준비돼 있다', () => {
    expect(LUNCH_KAKAO_QUERIES).toContain('한식');
    expect(LUNCH_KAKAO_QUERIES.length).toBeGreaterThanOrEqual(5);
  });
});
