import { describe, expect, it } from 'vitest';
import { guideFileName } from '../src/utils/downloadHtml.js';

describe('guideFileName', () => {
  it('제목을 .html 파일 이름으로 바꾼다', () => {
    expect(guideFileName('로드밸런서 장애·생성 가이드')).toBe('로드밸런서 장애·생성 가이드.html');
  });
  it('경로·특수문자를 제거한다', () => {
    expect(guideFileName('../a/b:c*"d"?.html')).toBe('a b c d .html.html');
    expect(guideFileName('///')).toBe('guide.html');
  });
  it('빈 제목은 기본 이름을 쓴다', () => {
    expect(guideFileName('')).toBe('guide.html');
    expect(guideFileName(null, 'x')).toBe('x.html');
  });
});
