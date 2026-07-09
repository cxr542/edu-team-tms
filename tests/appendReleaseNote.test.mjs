import { describe, expect, it } from 'vitest';
import {
  alreadyHasPrEntry,
  applyReleaseNote,
  buildReleaseSection,
  extractReleaseBullets,
  prependReleaseSection,
  sanitizeReleaseNoteText,
  seoulDateKey,
} from '../scripts/append-release-note.mjs';

const FIXTURE = `# TMS · 팀 KPI 릴리즈 노트

교육팀 TMS와 **팀 KPI 관리** 변경 이력입니다.

---

## 2026-06-17 — 기존 항목

- 기존 불릿

---

### 문서 수정 방법

1. SoT 수정
`;

describe('append-release-note helpers', () => {
  it('formats Asia/Seoul date as YYYY-MM-DD', () => {
    expect(seoulDateKey(new Date('2026-07-08T16:00:00.000Z'))).toBe('2026-07-09');
  });

  it('extracts bullets under ## 릴리즈', () => {
    const body = `## Summary\n\nhello\n\n## 릴리즈\n\n- 첫 변경\n- 둘째 변경\n\n## 테스트\n\n- ignore\n`;
    expect(extractReleaseBullets(body)).toEqual(['- 첫 변경', '- 둘째 변경']);
  });

  it('extracts bullets under ## Release notes and skips placeholders', () => {
    const body = `## Release notes\n\n- (사용자에게 보일 변경 한 줄)\n- Real change\n`;
    expect(extractReleaseBullets(body)).toEqual(['- Real change']);
  });

  it('escapes PR-provided HTML before writing release notes', () => {
    expect(sanitizeReleaseNoteText('<img src=x onerror=alert(1)> & ok')).toBe(
      '&lt;img src=x onerror=alert(1)&gt; &amp; ok'
    );
    expect(extractReleaseBullets('## 릴리즈\n\n- <script>alert(1)</script>\n')).toEqual([
      '- &lt;script&gt;alert(1)&lt;/script&gt;',
    ]);
  });

  it('returns empty when release section missing', () => {
    expect(extractReleaseBullets('## Summary\n\n- only')).toEqual([]);
  });

  it('detects existing PR entries', () => {
    expect(alreadyHasPrEntry('see PR #86 here', { number: 86 })).toBe(true);
    expect(alreadyHasPrEntry('https://github.com/o/r/pull/86', { number: 86 })).toBe(true);
    expect(alreadyHasPrEntry('PR #85 only', { number: 86 })).toBe(false);
  });

  it('builds section with body bullets and PR link', () => {
    const section = buildReleaseSection({
      title: 'Restyle announcements',
      number: 86,
      url: 'https://github.com/cxr542/edu-team-tms/pull/86',
      body: '## 릴리즈\n\n- 타임라인 피드\n',
      date: '2026-07-09',
    });
    expect(section).toContain('## 2026-07-09 — Restyle announcements');
    expect(section).toContain('- 타임라인 피드');
    expect(section).toContain('- PR #86: https://github.com/cxr542/edu-team-tms/pull/86');
  });

  it('falls back to title bullet when no release section', () => {
    const section = buildReleaseSection({
      title: 'Fix deploy',
      number: 82,
      url: 'https://example.com/pull/82',
      body: 'no section',
      date: '2026-07-01',
    });
    expect(section).toContain('- Fix deploy');
    expect(section).toContain('- PR #82:');
  });

  it('collapses unsafe title markup into a single escaped heading', () => {
    const section = buildReleaseSection({
      title: 'Fix docs\n\n## Injected\n<img src=x onerror=alert(1)>',
      number: 101,
      url: 'https://example.com/pull/101',
      date: '2026-07-09',
    });
    expect(section).toContain(
      '## 2026-07-09 — Fix docs ## Injected &lt;img src=x onerror=alert(1)&gt;'
    );
    expect(section).not.toContain('\n## Injected');
    expect(section).not.toContain('<img');
  });

  it('prepends after intro separator and keeps footer', () => {
    const section = buildReleaseSection({
      title: 'New',
      number: 99,
      url: 'https://example.com/pull/99',
      date: '2026-07-09',
    });
    const next = prependReleaseSection(FIXTURE, section);
    expect(next.indexOf('## 2026-07-09 — New')).toBeLessThan(next.indexOf('## 2026-06-17 — 기존 항목'));
    expect(next).toContain('### 문서 수정 방법');
    expect(next).toContain('교육팀 TMS');
  });

  it('applyReleaseNote updates then skips duplicates', () => {
    const first = applyReleaseNote(FIXTURE, {
      title: 'Auto notes',
      number: 100,
      url: 'https://example.com/pull/100',
      body: '## 릴리즈\n\n- auto\n',
      date: '2026-07-09',
    });
    expect(first.status).toBe('updated');
    expect(first.markdown).toContain('PR #100');

    const second = applyReleaseNote(first.markdown, {
      title: 'Auto notes again',
      number: 100,
      url: 'https://example.com/pull/100',
      date: '2026-07-09',
    });
    expect(second.status).toBe('skipped');
    expect(second.reason).toMatch(/already present/);
  });

  it('skips when title or number missing', () => {
    expect(applyReleaseNote(FIXTURE, { title: '', number: 1 }).status).toBe('skipped');
    expect(applyReleaseNote(FIXTURE, { title: 'x', number: '' }).status).toBe('skipped');
  });
});
