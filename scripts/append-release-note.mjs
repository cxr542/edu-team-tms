#!/usr/bin/env node
/**
 * Prepend a PR-derived section to docs/reference-source/TMS-릴리즈노트.md
 * and sync the published copy under public/docs/reference/.
 *
 * Usage:
 *   node scripts/append-release-note.mjs \
 *     --title "..." --number 86 --url "https://..." [--body "..."] [--date YYYY-MM-DD]
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
      // Skip empty template placeholders
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
 * Build markdown section for one merged PR.
 * @param {{ title: string, number: number|string, url: string, body?: string, date?: string }} pr
 */
export function buildReleaseSection(pr) {
  const title = sanitizeReleaseNoteText(pr.title || '');
  const number = String(pr.number || '').trim();
  const url = String(pr.url || '').trim();
  const date = String(pr.date || seoulDateKey()).trim();

  if (!title || !number) {
    return null;
  }

  const fromBody = extractReleaseBullets(pr.body || '');
  const bullets =
    fromBody.length > 0 ? fromBody : [`- ${title}`];

  const lines = [`## ${date} — ${title}`, '', ...bullets];
  if (url) {
    lines.push(`- PR #${number}: ${url}`);
  } else {
    lines.push(`- PR #${number}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Insert section after the first intro `---` separator.
 * @param {string} markdown
 * @param {string} section
 */
export function prependReleaseSection(markdown, section) {
  const md = String(markdown || '');
  const sectionBlock = String(section || '').replace(/\n+$/, '') + '\n';
  const sepIndex = md.indexOf(INTRO_SEPARATOR);
  if (sepIndex === -1) {
    // Fallback: insert after first blank line following H1
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
  const section = buildReleaseSection(pr);
  if (!section) {
    return { status: 'skipped', reason: 'empty section', markdown };
  }
  // Preserve footer marker presence (no structural change required)
  if (!String(markdown).includes(FOOTER_MARKER)) {
    // still allow update; footer is documentation only
  }
  return {
    status: 'updated',
    reason: `appended PR #${number}`,
    markdown: prependReleaseSection(markdown, section),
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
