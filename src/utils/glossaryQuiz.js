const MAX_PARAGRAPH_LENGTH = 360;

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanMarkdownText(text) {
  return String(text || '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .replace(/_([^_]*)_/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^>\s?/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSkippableBlock(block) {
  if (!block) return true;
  if (/^#{1,6}\s/.test(block)) return true; // heading
  if (/^!\[/.test(block)) return true; // image
  if (/^[-*]{3,}$/.test(block)) return true; // hr
  if (/^\|/.test(block)) return true; // table row
  if (/^[-*+]\s/.test(block)) return true; // list item (not prose)
  return false;
}

/** First non-heading prose block of a glossary term's markdown body. */
export function extractFirstParagraph(body) {
  const blocks = String(body || '')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const found = blocks.find((block) => !isSkippableBlock(block));
  if (!found) return '';

  const cleaned = cleanMarkdownText(found);
  if (cleaned.length <= MAX_PARAGRAPH_LENGTH) return cleaned;
  return `${cleaned.slice(0, MAX_PARAGRAPH_LENGTH)}…`;
}

/** Mask the term's own name so a short-answer question doesn't give itself away. */
export function maskTermName(text, term) {
  let masked = String(text || '');
  const names = [term.title, term.slug].filter((n) => n && n.length >= 2);
  names.forEach((name) => {
    const pattern = new RegExp(escapeRegExp(name), 'gi');
    masked = masked.replace(pattern, '○'.repeat(Math.min(name.length, 6)));
  });
  return masked;
}

function normalizeAnswerText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '');
}

export function checkShortAnswer(userInput, question) {
  const input = normalizeAnswerText(userInput);
  if (!input) return false;
  return (
    input === normalizeAnswerText(question.answer.slug) ||
    input === normalizeAnswerText(question.answer.title)
  );
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickOther(list, excludeSlug) {
  const candidates = list.filter((t) => t.slug !== excludeSlug);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export const QUIZ_SUBJECT_OPTIONS = [
  { value: 'all', label: '전체', tag: null },
  { value: 'cloud', label: '클라우드', tag: 'cloud-101' },
  { value: 'ai', label: 'AI', tag: 'ai-101' },
];

function matchesSubject(term, subject) {
  if (!subject || subject === 'all') return true;
  const option = QUIZ_SUBJECT_OPTIONS.find((o) => o.value === subject);
  if (!option || !option.tag) return true;
  return (term.tags || []).includes(option.tag);
}

/**
 * Terms usable as quiz material: published, with a title and an extractable
 * first paragraph. `subject` ('all' | 'cloud' | 'ai') filters by the term's
 * subject tag (cloud-101 / ai-101) — entries are tagged via the glossary
 * admin UI, so re-tagging an entry changes its subject with no code change.
 */
export function getEligibleQuizTerms(terms, { subject = 'all' } = {}) {
  return (terms || [])
    .filter((t) => (t.visibility || 'published') === 'published')
    .filter((t) => matchesSubject(t, subject))
    .map((t) => ({ ...t, firstParagraph: extractFirstParagraph(t.body) }))
    .filter((t) => t.title && t.firstParagraph);
}

function buildStatementOxQuestion(entry, pool) {
  const donor = pickOther(pool, entry.slug);
  if (!donor) return null;

  const isTrue = Math.random() < 0.5;
  const sentence = isTrue ? entry.firstParagraph : donor.firstParagraph;

  return {
    id: `ox-statement-${entry.slug}`,
    type: 'ox-statement',
    prompt: `다음은 「${entry.title}」에 대한 설명이다: "${sentence}"`,
    termSlug: entry.slug,
    termTitle: entry.title,
    answer: isTrue ? 'O' : 'X',
    explanation: isTrue ? null : `실제로는 「${donor.title}」에 대한 설명입니다.`,
  };
}

function buildShortAnswerQuestion(entry) {
  return {
    id: `short-answer-${entry.slug}`,
    type: 'short-answer',
    prompt: maskTermName(entry.firstParagraph, entry),
    termSlug: entry.slug,
    termTitle: entry.title,
    answer: { slug: entry.slug, title: entry.title },
  };
}

export const QUIZ_TYPE_OPTIONS = ['mixed', 'ox', 'short-answer'];

/**
 * Build up to `count` quiz questions from live glossary terms.
 * Never exceeds the number of eligible entries.
 * `type`: 'mixed' (default) | 'ox' | 'short-answer' — restricts the question
 * format. Falls back to short-answer per-entry when an OX question can't be
 * built for that entry (e.g. no distinct donor entry available).
 */
export function buildQuizQuestions(terms, { count = 8, type = 'mixed', subject = 'all' } = {}) {
  const pool = getEligibleQuizTerms(terms, { subject });
  const total = Math.max(0, Math.min(count, pool.length));
  if (total === 0) return [];

  const primaries = shuffle(pool).slice(0, total);
  const typeOrder =
    type === 'ox'
      ? Array.from({ length: total }, () => 'ox-statement')
      : type === 'short-answer'
      ? Array.from({ length: total }, () => 'short-answer')
      : shuffle(Array.from({ length: total }, (_, i) => ['short-answer', 'ox-statement'][i % 2]));

  return primaries.map((entry, index) => {
    const preferredType = typeOrder[index];
    if (preferredType === 'ox-statement') {
      return buildStatementOxQuestion(entry, pool) || buildShortAnswerQuestion(entry);
    }
    return buildShortAnswerQuestion(entry);
  });
}

export function isOxQuestion(question) {
  return question.type === 'ox-statement';
}

export function checkAnswer(question, userAnswer) {
  if (isOxQuestion(question)) return userAnswer === question.answer;
  return checkShortAnswer(userAnswer, question);
}

export function formatCorrectAnswerDisplay(question) {
  if (isOxQuestion(question)) return question.answer === 'O' ? '참 (O)' : '거짓 (X)';
  return question.answer.title;
}
