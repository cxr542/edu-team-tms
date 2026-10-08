import { describe, expect, it } from 'vitest';
import { formatNumberedItems, needsNumberedItemBreaks } from '../src/utils/evidenceText.js';

describe('formatNumberedItems', () => {
  it('한 줄로 이어진 번호 항목에 줄바꿈을 넣는다', () => {
    const src = '1. 회고 보고서 작성 2. CXMS 화면 설계 3. 만족도 설문 구성';
    expect(formatNumberedItems(src)).toBe('1. 회고 보고서 작성\n2. CXMS 화면 설계\n3. 만족도 설문 구성');
    expect(needsNumberedItemBreaks(src)).toBe(true);
  });

  it('이미 줄바꿈된 항목은 그대로 둔다', () => {
    const src = '1. 하나\n2. 둘\n3. 셋';
    expect(formatNumberedItems(src)).toBe(src);
    expect(needsNumberedItemBreaks(src)).toBe(false);
  });

  it('날짜·숫자 나열은 건드리지 않는다', () => {
    const src = '2026. 10. 8. 에 배포했고 버전은 v2. 0 이다';
    expect(formatNumberedItems(src)).toBe(src);
  });

  it('1번부터 순서가 이어질 때만 처리한다', () => {
    expect(formatNumberedItems('결과 2. 둘 3. 셋')).toBe('결과 2. 둘 3. 셋');
    expect(formatNumberedItems('1. 하나 3. 셋')).toBe('1. 하나 3. 셋');
  });

  it('빈 값·null 안전', () => {
    expect(formatNumberedItems('')).toBe('');
    expect(formatNumberedItems(null)).toBe('');
  });
});
