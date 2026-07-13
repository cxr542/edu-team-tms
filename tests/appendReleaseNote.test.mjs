import { describe, expect, it } from 'vitest';
import {
  alreadyHasPrEntry,
  applyReleaseNote,
  buildReleaseEntry,
  buildReleaseSection,
  extractReleaseBullets,
  extractReleaseKind,
  formatReleaseEntryHeading,
  inferReleaseKindFromTitle,
  mergeReleaseEntryForDate,
  normalizeReleaseKind,
  prependReleaseSection,
  regroupReleaseNotesByDay,
  resolveReleaseKind,
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

  it('skips 유형 meta bullets when collecting release lines', () => {
    const body = `## 릴리즈\n\n- 유형: 신규\n- 타임라인 피드\n`;
    expect(extractReleaseBullets(body)).toEqual(['- 타임라인 피드']);
    expect(extractReleaseKind(body)).toBe('신규');
  });

  it('normalizes and infers release kinds', () => {
    expect(normalizeReleaseKind('update')).toBe('업데이트');
    expect(normalizeReleaseKind('Fix')).toBe('수정');
    expect(inferReleaseKindFromTitle('Add J8 feature')).toBe('신규');
    expect(inferReleaseKindFromTitle('Fix journal bug')).toBe('수정');
    expect(inferReleaseKindFromTitle('docs: tweak footer')).toBe('문서');
    expect(resolveReleaseKind({ title: 'Add X', body: '## 릴리즈\n\n- 유형: 문서\n' })).toBe(
      '문서'
    );
    expect(formatReleaseEntryHeading('업데이트', 'Hello')).toBe('### [업데이트] Hello');
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

  it('builds day section with ### entry, body bullets and PR link', () => {
    const section = buildReleaseSection({
      title: 'Restyle announcements',
      number: 86,
      url: 'https://github.com/cxr542/edu-team-tms/pull/86',
      body: '## 릴리즈\n\n- 유형: 업데이트\n- 타임라인 피드\n',
      date: '2026-07-09',
    });
    expect(section).toContain('## 2026-07-09\n');
    expect(section).toContain('### [업데이트] Restyle announcements');
    expect(section).not.toContain('- 유형:');
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
    expect(section).toContain('### [수정] Fix deploy');
    expect(section).toContain('- Fix deploy');
    expect(section).toContain('- PR #82:');
  });

  it('collapses unsafe title markup into a single escaped heading', () => {
    const entry = buildReleaseEntry({
      title: 'Fix docs\n\n## Injected\n<img src=x onerror=alert(1)>',
      number: 101,
      url: 'https://example.com/pull/101',
      kind: '수정',
    });
    expect(entry).toContain(
      '### [수정] Fix docs ## Injected &lt;img src=x onerror=alert(1)&gt;'
    );
    expect(entry).not.toContain('\n## Injected');
    expect(entry).not.toContain('<img');
  });

  it('prepends after intro separator and keeps footer', () => {
    const section = buildReleaseSection({
      title: 'New',
      number: 99,
      url: 'https://example.com/pull/99',
      date: '2026-07-09',
    });
    const next = prependReleaseSection(FIXTURE, section);
    expect(next.indexOf('## 2026-07-09')).toBeLessThan(next.indexOf('## 2026-06-17'));
    expect(next).toContain('### 문서 수정 방법');
    expect(next).toContain('교육팀 TMS');
  });

  it('merges two PRs on the same day under one H2 with newest first', () => {
    const first = applyReleaseNote(FIXTURE, {
      title: 'First',
      number: 100,
      url: 'https://example.com/pull/100',
      body: '## 릴리즈\n\n- first\n',
      date: '2026-07-09',
    });
    expect(first.status).toBe('updated');
    const second = applyReleaseNote(first.markdown, {
      title: 'Second',
      number: 101,
      url: 'https://example.com/pull/101',
      body: '## 릴리즈\n\n- second\n',
      date: '2026-07-09',
    });
    expect(second.status).toBe('updated');
    const md = second.markdown;
    expect(md.match(/## 2026-07-09/g)?.length).toBe(1);
    expect(md.indexOf('### [업데이트] Second')).toBeLessThan(md.indexOf('### [업데이트] First'));
    expect(md).toContain('## 2026-06-17');
    expect(md).toContain('### 기존 항목');
  });

  it('keeps separate day H2s for different dates', () => {
    const a = applyReleaseNote(FIXTURE, {
      title: 'A',
      number: 200,
      url: 'https://example.com/pull/200',
      date: '2026-07-10',
    });
    const b = applyReleaseNote(a.markdown, {
      title: 'B',
      number: 201,
      url: 'https://example.com/pull/201',
      date: '2026-07-09',
    });
    expect(b.markdown).toContain('## 2026-07-10');
    expect(b.markdown).toContain('## 2026-07-09');
    // Newest applied day (07-09) is prepended ahead of earlier day (07-10)
    expect(b.markdown.indexOf('## 2026-07-09')).toBeLessThan(b.markdown.indexOf('## 2026-07-10'));
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

  it('regroupReleaseNotesByDay collapses legacy same-day H2s', () => {
    const legacy = `# Title

intro

---

## 2026-07-10 — Alpha

- a
- PR #1: https://example.com/1

## 2026-07-10 — Beta

- b
- PR #2: https://example.com/2

## 2026-07-09 — Gamma

- c

## 2026-06 — Month summary

- old

---

### 문서 수정 방법

1. edit
`;
    const next = regroupReleaseNotesByDay(legacy);
    expect(next.match(/## 2026-07-10\n/g)?.length).toBe(1);
    expect(next).toContain('### Alpha');
    expect(next).toContain('### Beta');
    expect(next.indexOf('### Alpha')).toBeLessThan(next.indexOf('### Beta'));
    expect(next).toContain('## 2026-07-09');
    expect(next).toContain('### Gamma');
    expect(next).toContain('## 2026-06 — Month summary');
    expect(next).toContain('### 문서 수정 방법');
    expect(regroupReleaseNotesByDay(next)).toContain('## 2026-07-10\n');
  });

  it('mergeReleaseEntryForDate inserts at top of existing day', () => {
    const grouped = regroupReleaseNotesByDay(FIXTURE);
    const entry = buildReleaseEntry({
      title: 'Fresh',
      number: 55,
      url: 'https://example.com/pull/55',
      kind: '신규',
    });
    const next = mergeReleaseEntryForDate(grouped, '2026-06-17', entry);
    expect(next.match(/## 2026-06-17\n/g)?.length).toBe(1);
    expect(next.indexOf('### [신규] Fresh')).toBeLessThan(next.indexOf('### 기존 항목'));
  });
});
