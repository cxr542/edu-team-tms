import { describe, expect, it } from 'vitest';
import { ALLOWED_HOST_RE } from '../api/kakao-local.js';

// 회귀 테스트: api/kakao-local.js의 ALLOWED_HOST_RE 정규식 버그.
// `|` 대안이 그룹으로 묶여 있지 않으면 (a) 실제 운영 도메인(-ten 접미사)이
// 거부되고 (b) "localhost"라는 글자만 포함하면 무관한 외부 도메인도 통과된다.
describe('kakao-local ALLOWED_HOST_RE', () => {
  it('실제 운영 도메인(-ten 접미사 포함)을 허용한다', () => {
    expect(ALLOWED_HOST_RE.test('https://edu-team-tms-ten.vercel.app/')).toBe(true);
    expect(ALLOWED_HOST_RE.test('https://edu-team-tms-ten.vercel.app/lunch')).toBe(true);
  });

  it('대체 운영 도메인을 허용한다', () => {
    expect(ALLOWED_HOST_RE.test('https://okestro-edu-team-tms.vercel.app/')).toBe(true);
  });

  it('로컬 개발 서버를 허용한다', () => {
    expect(ALLOWED_HOST_RE.test('http://localhost:3000/')).toBe(true);
    expect(ALLOWED_HOST_RE.test('http://localhost:3000')).toBe(true);
  });

  it('"localhost" 문자열만 포함한 무관한 외부 도메인은 거부한다', () => {
    expect(ALLOWED_HOST_RE.test('https://evil.com/?x=localhost')).toBe(false);
    expect(ALLOWED_HOST_RE.test('https://attacker.example/path/localhost-thing')).toBe(false);
  });

  it('허용 도메인을 접미사로 가장한 도메인은 거부한다', () => {
    expect(ALLOWED_HOST_RE.test('https://edu-team-tms-ten.vercel.app.evil.com/')).toBe(false);
  });

  it('전혀 관계없는 도메인은 거부한다', () => {
    expect(ALLOWED_HOST_RE.test('https://totally-unrelated-site.com/')).toBe(false);
  });
});
