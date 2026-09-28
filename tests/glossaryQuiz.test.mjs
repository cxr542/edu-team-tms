import { describe, expect, it } from 'vitest';
import { GLOSSARY_SEED_ENTRIES } from '../src/data/glossarySeedEntries.js';
import { normalizeGlossaryTerm } from '../src/utils/glossarySupabase.js';
import {
  buildQuizQuestions,
  checkAnswer,
  checkShortAnswer,
  extractFirstParagraph,
  formatCorrectAnswerDisplay,
  getEligibleQuizTerms,
  isOxQuestion,
  maskTermName,
} from '../src/utils/glossaryQuiz.js';
import { resolveAppModuleId } from '../src/utils/appRoute.js';
import { TEAM_COMMON_MODULES } from '../src/constants/teamAccess.js';

const SEED_TERMS = GLOSSARY_SEED_ENTRIES.map(normalizeGlossaryTerm).filter(Boolean);

describe('extractFirstParagraph', () => {
  it('skips a leading markdown heading and returns the next prose block', () => {
    const body = '# Streaming Multiprocessor (SM)\n\n**SM**은 NVIDIA GPU의 핵심 연산 단위입니다.\n\n## 한 줄 정의\n\n다음 문단.';
    const result = extractFirstParagraph(body);
    expect(result).toContain('SM은 NVIDIA GPU의 핵심 연산 단위입니다');
    expect(result).not.toContain('#');
  });

  it('strips markdown emphasis and link syntax', () => {
    const body = '**굵게** 그리고 `코드` 그리고 [링크](https://example.com) 텍스트입니다.';
    const result = extractFirstParagraph(body);
    expect(result).toBe('굵게 그리고 코드 그리고 링크 텍스트입니다.');
  });

  it('returns an empty string when there is no usable prose block', () => {
    expect(extractFirstParagraph('# 제목만 있음')).toBe('');
    expect(extractFirstParagraph('')).toBe('');
  });

  it('produces a non-empty first paragraph for every published seed entry', () => {
    SEED_TERMS.forEach((term) => {
      expect(extractFirstParagraph(term.body).length).toBeGreaterThan(0);
    });
  });
});

describe('maskTermName', () => {
  it('replaces occurrences of the term title and slug', () => {
    const term = { title: 'Gemini', slug: 'gemini' };
    const masked = maskTermName('Gemini는 구글의 모델이며 gemini API로 접근합니다.', term);
    expect(masked).not.toMatch(/gemini/i);
    expect(masked).toContain('○');
  });
});

describe('checkShortAnswer / checkAnswer', () => {
  const question = {
    type: 'short-answer',
    answer: { slug: 'google-gemini', title: 'Google Gemini' },
  };

  it('matches ignoring case and whitespace against slug or title', () => {
    expect(checkShortAnswer('google-gemini', question)).toBe(true);
    expect(checkShortAnswer('  Google   Gemini ', question)).toBe(true);
    expect(checkShortAnswer('GOOGLE-GEMINI', question)).toBe(true);
    expect(checkShortAnswer('wrong answer', question)).toBe(false);
    expect(checkShortAnswer('', question)).toBe(false);
  });

  it('checkAnswer delegates OX questions to strict equality', () => {
    const oxQuestion = { type: 'ox-statement', answer: 'O' };
    expect(checkAnswer(oxQuestion, 'O')).toBe(true);
    expect(checkAnswer(oxQuestion, 'X')).toBe(false);
    expect(isOxQuestion(oxQuestion)).toBe(true);
    expect(isOxQuestion(question)).toBe(false);
  });
});

describe('formatCorrectAnswerDisplay', () => {
  it('formats OX answers in Korean', () => {
    expect(formatCorrectAnswerDisplay({ type: 'ox-statement', answer: 'O' })).toBe('참 (O)');
    expect(formatCorrectAnswerDisplay({ type: 'ox-statement', answer: 'X' })).toBe('거짓 (X)');
  });

  it('formats short-answer answers as the term title', () => {
    expect(
      formatCorrectAnswerDisplay({ type: 'short-answer', answer: { slug: 'x', title: 'X 용어' } })
    ).toBe('X 용어');
  });
});

describe('getEligibleQuizTerms', () => {
  it('excludes non-published entries and entries without a usable first paragraph', () => {
    const terms = [
      { title: 'A', slug: 'a', body: '내용이 있는 설명 문단입니다.', visibility: 'published' },
      { title: 'B', slug: 'b', body: '초안 문단입니다.', visibility: 'draft' },
      { title: '', slug: 'c', body: '내용은 있지만 제목이 없습니다.', visibility: 'published' },
      { title: 'D', slug: 'd', body: '# 헤딩만', visibility: 'published' },
    ];
    const eligible = getEligibleQuizTerms(terms);
    expect(eligible.map((t) => t.slug)).toEqual(['a']);
  });

  it('finds all real seed entries eligible (they are all published with prose bodies)', () => {
    expect(getEligibleQuizTerms(SEED_TERMS).length).toBe(SEED_TERMS.length);
  });

  it('filters by subject tag (cloud-101 / ai-101), matching the seed data split', () => {
    const cloud = getEligibleQuizTerms(SEED_TERMS, { subject: 'cloud' });
    const ai = getEligibleQuizTerms(SEED_TERMS, { subject: 'ai' });
    expect(cloud.map((t) => t.slug).sort()).toEqual(['sns', 'vmware-vcf', 'vmware-vvf']);
    expect(ai.length).toBe(SEED_TERMS.length - 3);
    expect(cloud.length + ai.length).toBe(SEED_TERMS.length);
  });

  it('subject "all" (or omitted) returns everything, same as no filter', () => {
    expect(getEligibleQuizTerms(SEED_TERMS, { subject: 'all' }).length).toBe(SEED_TERMS.length);
  });
});

describe('buildQuizQuestions', () => {
  it('never returns more questions than eligible entries', () => {
    const questions = buildQuizQuestions(SEED_TERMS, { count: 1000 });
    expect(questions.length).toBeLessThanOrEqual(SEED_TERMS.length);
    expect(questions.length).toBe(getEligibleQuizTerms(SEED_TERMS).length);
  });

  it('respects a requested count smaller than the pool', () => {
    const questions = buildQuizQuestions(SEED_TERMS, { count: 5 });
    expect(questions.length).toBe(5);
  });

  it('returns no duplicate term slugs across the generated questions', () => {
    const questions = buildQuizQuestions(SEED_TERMS, { count: 10 });
    const slugs = questions.map((q) => q.termSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('returns an empty array when there are no eligible terms', () => {
    expect(buildQuizQuestions([], { count: 5 })).toEqual([]);
  });

  it('type: "ox" builds only OX questions', () => {
    const questions = buildQuizQuestions(SEED_TERMS, { count: 10, type: 'ox' });
    questions.forEach((q) => expect(q.type).toBe('ox-statement'));
  });

  it('type: "short-answer" builds only short-answer questions', () => {
    const questions = buildQuizQuestions(SEED_TERMS, { count: 10, type: 'short-answer' });
    questions.forEach((q) => expect(q.type).toBe('short-answer'));
  });

  it('subject: "cloud" only draws questions from cloud-101-tagged entries', () => {
    const questions = buildQuizQuestions(SEED_TERMS, { count: 3, subject: 'cloud' });
    const cloudSlugs = new Set(['vmware-vvf', 'vmware-vcf', 'sns']);
    questions.forEach((q) => expect(cloudSlugs.has(q.termSlug)).toBe(true));
  });

  it('subject: "ai" never draws questions from the cloud-101 entries', () => {
    const questions = buildQuizQuestions(SEED_TERMS, { count: 10, subject: 'ai' });
    const cloudSlugs = new Set(['vmware-vvf', 'vmware-vcf', 'sns']);
    questions.forEach((q) => expect(cloudSlugs.has(q.termSlug)).toBe(false));
  });

  it('every generated question has a valid type and non-empty prompt', () => {
    const questions = buildQuizQuestions(SEED_TERMS, { count: 12 });
    questions.forEach((q) => {
      expect(['ox-statement', 'short-answer']).toContain(q.type);
      expect(q.prompt.length).toBeGreaterThan(0);
      expect(q.termTitle).toBeTruthy();
    });
  });
});

describe('glossary-quiz module wiring', () => {
  it('is a recognized app module id', () => {
    expect(resolveAppModuleId('glossary-quiz')).toBe('glossary-quiz');
  });

  it('is accessible to member-scoped team access (TEAM_COMMON_MODULES)', () => {
    expect(TEAM_COMMON_MODULES.has('glossary-quiz')).toBe(true);
  });
});
