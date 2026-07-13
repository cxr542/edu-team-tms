#!/usr/bin/env node
/**
 * Prepend / merge a PR-derived entry into docs/reference-source/TMS-릴리즈노트.md
 * grouped by Asia/Seoul calendar day, and sync public/docs/reference/.
 *
 * Format:
 *   ## YYYY-MM-DD
 *   ### PR title
 *   - bullets
 *   - PR #N: url
 *
 * Usage:
 *   node scripts/append-release-note.mjs \
 *     --title "..." --number 86 --url "https://..." [--body "..."] [--date YYYY-MM-DD]
 *   node scripts/append-release-note.mjs --regroup-only [--no-sync]
 *
 * Env fallbacks: PR_TITLE, PR_NUMBER, PR_URL, PR_BODY, RELEASE_NOTE_DATE
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMS_ROOT = path.resolve(__dirname, '..');
export const RELEASE_NOTE_SOT = path.join(TMS_ROOT, 'docs/reference-source/TMS-릴리즈노트.md');
export const RELEASE_NOTE_PUBLIC = path.join(TMS_ROOT, 'public/docs/reference/TMS-릴리즈노트.md');

const INTRO_SEPARATOR = '\n---\n';
const FOOTER_MARKER = '### 문서 수정 방법';
const DAY_H2_RE = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/;
const LEGACY_DAY_H2_RE = /^##\s+(\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.+)\s*$/;

/**
 * Asia/Seoul calendar date as YYYY-MM-DD.
 * @param {Date} [now]
 */
export function seoulDateKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Keep PR-provided release-note text as plain Markdown text.
 * Raw HTML would later be rendered through the in-app Markdown viewer.
 * @param {string} value
 */
export function sanitizeReleaseNoteText(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
}

/**
 * Extract bullet lines under ## 릴리즈 or ## Release notes.
 * @param {string} body
 * @returns {string[]}
 */
export function extractReleaseBullets(body) {
  const text = String(body || '').replace(/\r\n/g, '\n');
  if (!text.trim()) return [];

  const headingRe = /^##\s+(릴리즈|Release notes)\s*$/gim;
  const match = headingRe.exec(text);
  if (!match) return [];

  const start = match.index + match[0].length;
  const rest = text.slice(start);
  const nextHeading = rest.search(/\n##\s+/);
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);

  const bullets = [];
  for (const line of section.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const content = sanitizeReleaseNoteText(
        trimmed.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '').trim()
      );
      if (!content || /^\(.*\)$/.test(content)) continue;
      bullets.push(`- ${content}`);
    }
  }
  return bullets;
}

/**
 * @param {{ number: number|string, url?: string }} pr
 */
export function alreadyHasPrEntry(markdown, pr) {
  const n = String(pr.number);
  const md = String(markdown || '');
  if (new RegExp(`PR\\s*#${n}\\b`).test(md)) return true;
  if (new RegExp(`/pull/${n}(?:\\b|$)`).test(md)) return true;
  return false;
}

/**
 * Build one PR entry under a day heading (`### title` + bullets).
 * @param {{ title: string, number: number|string, url: string, body?: string }} pr
 */
export function buildReleaseEntry(pr) {
  const title = sanitizeReleaseNoteText(pr.title || '');
  const number = String(pr.number || '').trim();
  const url = String(pr.url || '').trim();

  if (!title || !number) {
    return null;
  }

  const fromBody = extractReleaseBullets(pr.body || '');
  const bullets = fromBody.length > 0 ? fromBody : [`- ${title}`];

  const lines = [`### ${title}`, '', ...bullets];
  if (url) {
    lines.push(`- PR #${number}: ${url}`);
  } else {
    lines.push(`- PR #${number}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Full markdown block for one PR (day H2 + entry). Used for fresh days / tests.
 * @param {{ title: string, number: number|string, url: string, body?: string, date?: string }} pr
 */
export function buildReleaseSection(pr) {
  const date = String(pr.date || seoulDateKey()).trim();
  const entry = buildReleaseEntry(pr);
  if (!entry || !date) return null;
  return `## ${date}\n\n${entry}`;
}

/**
 * @param {string} body under a ## heading (no heading line)
 * @returns {string[]} entry markdown blocks (each starts with ###)
 */
function splitDayBodyIntoEntries(body, fallbackTitle) {
  const text = String(body || '').replace(/\r\n/g, '\n').replace(/^\n+/, '').replace(/\n+$/, '');
  if (!text.trim()) {
    return fallbackTitle ? [`### ${sanitizeReleaseNoteText(fallbackTitle)}\n`] : [];
  }

  if (/^###\s+/m.test(text)) {
    const parts = text.split(/(?=^###\s+)/m).map((p) => p.replace(/\n+$/, '') + '\n');
    return parts.filter((p) => p.trim());
  }

  const title = sanitizeReleaseNoteText(fallbackTitle || 'Update');
  return [`### ${title}\n\n${text}\n`];
}

/**
 * Split markdown into intro / changelog body / footer.
 * @param {string} markdown
 */
export function splitReleaseNoteParts(markdown) {
  const md = String(markdown || '').replace(/\r\n/g, '\n');
  const sepIndex = md.indexOf(INTRO_SEPARATOR);
  let intro;
  let rest;
  if (sepIndex === -1) {
    const h1End = md.search(/\n\n/);
    if (h1End === -1) {
      return { intro: '', body: md, footer: '' };
    }
    intro = md.slice(0, h1End + 2);
    rest = md.slice(h1End + 2);
  } else {
    intro = md.slice(0, sepIndex + INTRO_SEPARATOR.length);
    rest = md.slice(sepIndex + INTRO_SEPARATOR.length);
  }

  const footerAt = rest.indexOf(FOOTER_MARKER);
  if (footerAt === -1) {
    return { intro, body: rest.replace(/^\n+/, '').replace(/\n+$/, ''), footer: '' };
  }

  let bodyEnd = footerAt;
  const beforeFooter = rest.slice(0, footerAt);
  const dashIdx = beforeFooter.lastIndexOf('\n---');
  if (dashIdx !== -1 && beforeFooter.slice(dashIdx).trim().startsWith('---')) {
    bodyEnd = dashIdx;
  }

  const body = rest.slice(0, bodyEnd).replace(/^\n+/, '').replace(/\n+$/, '');
  const footer = rest.slice(bodyEnd).replace(/^\n+/, '');
  return { intro, body, footer };
}

/**
 * Parse changelog body into ordered day groups + other H2 sections.
 * @param {string} body
 */
function parseChangelogBody(body) {
  const text = String(body || '').replace(/\r\n/g, '\n').replace(/^\n+/, '');
  if (!text.trim()) {
    return { dayOrder: [], dayEntries: new Map(), others: [] };
  }

  const lines = text.split('\n');
  /** @type {{ heading: string, body: string }[]} */
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      if (current) sections.push(current);
      current = { heading: line, body: '' };
    } else if (current) {
      current.body += `${line}\n`;
    }
  }
  if (current) sections.push(current);

  /** @type {string[]} */
  const dayOrder = [];
  /** @type {Map<string, string[]>} */
  const dayEntries = new Map();
  /** @type {string[]} */
  const others = [];

  for (const section of sections) {
    const dayOnly = section.heading.match(DAY_H2_RE);
    const legacy = section.heading.match(LEGACY_DAY_H2_RE);
    if (dayOnly) {
      const date = dayOnly[1];
      if (!dayEntries.has(date)) {
        dayEntries.set(date, []);
        dayOrder.push(date);
      }
      dayEntries.get(date).push(...splitDayBodyIntoEntries(section.body, null));
    } else if (legacy) {
      const date = legacy[1];
      const title = legacy[2].trim();
      if (!dayEntries.has(date)) {
        dayEntries.set(date, []);
        dayOrder.push(date);
      }
      dayEntries.get(date).push(...splitDayBodyIntoEntries(section.body, title));
    } else {
      others.push(`${section.heading}\n${section.body}`.replace(/\n+$/, '') + '\n');
    }
  }

  return { dayOrder, dayEntries, others };
}

function formatChangelogBody(dayOrder, dayEntries, others) {
  const parts = [];
  for (const date of dayOrder) {
    const entries = dayEntries.get(date) || [];
    if (entries.length === 0) continue;
    parts.push(`## ${date}\n`);
    for (const entry of entries) {
      parts.push(entry.replace(/\n+$/, '') + '\n');
    }
  }
  for (const other of others) {
    parts.push(other.replace(/\n+$/, '') + '\n');
  }
  return parts.join('\n').replace(/\n+$/, '') + '\n';
}

/**
 * Normalize legacy `## date — title` sections into `## date` + `### title`.
 * Idempotent on already-grouped markdown.
 * @param {string} markdown
 */
export function regroupReleaseNotesByDay(markdown) {
  const { intro, body, footer } = splitReleaseNoteParts(markdown);
  const { dayOrder, dayEntries, others } = parseChangelogBody(body);
  const nextBody = formatChangelogBody(dayOrder, dayEntries, others);
  const footerPart = footer
    ? footer.startsWith('---')
      ? `\n${footer.replace(/^\n+/, '')}`
      : `\n---\n\n${footer.replace(/^\n+/, '')}`
    : '';
  return `${intro.replace(/\n+$/, '')}\n\n${nextBody}${footerPart}`.replace(/\n{3,}/g, '\n\n');
}

/**
 * Insert section after the first intro `---` separator (full day block or raw).
 * @param {string} markdown
 * @param {string} section
 */
export function prependReleaseSection(markdown, section) {
  const md = String(markdown || '');
  const sectionBlock = String(section || '').replace(/\n+$/, '') + '\n';
  const sepIndex = md.indexOf(INTRO_SEPARATOR);
  if (sepIndex === -1) {
    const h1End = md.search(/\n\n/);
    if (h1End === -1) return `${sectionBlock}\n${md}`;
    return `${md.slice(0, h1End + 2)}${sectionBlock}\n${md.slice(h1End + 2).replace(/^\n+/, '')}`;
  }
  const insertAt = sepIndex + INTRO_SEPARATOR.length;
  const before = md.slice(0, insertAt);
  const after = md.slice(insertAt).replace(/^\n+/, '');
  return `${before}\n${sectionBlock}\n${after}`;
}

/**
 * Merge a PR entry under `## YYYY-MM-DD` (newest entry first within the day).
 * @param {string} markdown
 * @param {string} date YYYY-MM-DD
 * @param {string} entry markdown starting with ###
 */
export function mergeReleaseEntryForDate(markdown, date, entry) {
  const day = String(date || '').trim();
  const entryBlock = String(entry || '').replace(/\n+$/, '') + '\n';
  if (!day || !entryBlock.trim()) return markdown;

  const normalized = regroupReleaseNotesByDay(markdown);
  const { intro, body, footer } = splitReleaseNoteParts(normalized);
  const { dayOrder, dayEntries, others } = parseChangelogBody(body);

  if (dayEntries.has(day)) {
    dayEntries.set(day, [entryBlock, ...(dayEntries.get(day) || [])]);
  } else {
    dayOrder.unshift(day);
    dayEntries.set(day, [entryBlock]);
  }

  const nextBody = formatChangelogBody(dayOrder, dayEntries, others);
  const footerPart = footer
    ? footer.startsWith('---')
      ? `\n${footer.replace(/^\n+/, '')}`
      : `\n---\n\n${footer.replace(/^\n+/, '')}`
    : '';
  return `${intro.replace(/\n+$/, '')}\n\n${nextBody}${footerPart}`.replace(/\n{3,}/g, '\n\n');
}

/**
 * Apply PR entry to markdown string. Returns { status, markdown }.
 * status: 'updated' | 'skipped' | 'error'
 */
export function applyReleaseNote(markdown, pr) {
  const title = String(pr?.title || '').trim();
  const number = String(pr?.number || '').trim();
  if (!title || !number) {
    return { status: 'skipped', reason: 'missing title or number', markdown };
  }
  if (alreadyHasPrEntry(markdown, pr)) {
    return { status: 'skipped', reason: `PR #${number} already present`, markdown };
  }
  const entry = buildReleaseEntry(pr);
  if (!entry) {
    return { status: 'skipped', reason: 'empty section', markdown };
  }
  const date = String(pr.date || seoulDateKey()).trim();
  return {
    status: 'updated',
    reason: `merged PR #${number} under ${date}`,
    markdown: mergeReleaseEntryForDate(markdown, date, entry),
  };
}

function parseArgs(argv) {
  const out = {
    title: process.env.PR_TITLE || '',
    number: process.env.PR_NUMBER || '',
    url: process.env.PR_URL || '',
    body: process.env.PR_BODY || '',
    date: process.env.RELEASE_NOTE_DATE || '',
    file: RELEASE_NOTE_SOT,
    sync: true,
    regroupOnly: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--title' && next) {
      out.title = next;
      i += 1;
    } else if (arg === '--number' && next) {
      out.number = next;
      i += 1;
    } else if (arg === '--url' && next) {
      out.url = next;
      i += 1;
    } else if (arg === '--body' && next) {
      out.body = next;
      i += 1;
    } else if (arg === '--body-file' && next) {
      out.body = fs.readFileSync(path.resolve(next), 'utf8');
      i += 1;
    } else if (arg === '--date' && next) {
      out.date = next;
      i += 1;
    } else if (arg === '--file' && next) {
      out.file = path.resolve(next);
      i += 1;
    } else if (arg === '--no-sync') {
      out.sync = false;
    } else if (arg === '--regroup-only') {
      out.regroupOnly = true;
    }
  }
  return out;
}

function runSyncDocs() {
  const script = path.join(TMS_ROOT, 'scripts/sync-reference-docs.mjs');
  const result = spawnSync(process.execPath, [script], {
    cwd: TMS_ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`sync-reference-docs.mjs failed with status ${result.status}`);
  }
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!fs.existsSync(args.file)) {
    console.error(`release note file not found: ${args.file}`);
    process.exitCode = 1;
    return { status: 'error' };
  }

  const current = fs.readFileSync(args.file, 'utf8');

  if (args.regroupOnly) {
    const next = regroupReleaseNotesByDay(current);
    if (next === current) {
      console.log('skipped: already grouped by day');
      return { status: 'skipped', reason: 'already grouped', markdown: current };
    }
    fs.writeFileSync(args.file, next, 'utf8');
    console.log('updated: regrouped release notes by day');
    if (args.sync) {
      runSyncDocs();
    }
    return { status: 'updated', reason: 'regrouped by day', markdown: next };
  }

  const result = applyReleaseNote(current, {
    title: args.title,
    number: args.number,
    url: args.url,
    body: args.body,
    date: args.date || seoulDateKey(),
  });

  if (result.status === 'skipped') {
    console.log(`skipped: ${result.reason}`);
    return result;
  }

  fs.writeFileSync(args.file, result.markdown, 'utf8');
  console.log(`updated: ${result.reason}`);

  if (args.sync) {
    runSyncDocs();
  }

  return result;
}

const isDirectRun =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
  main();
}
