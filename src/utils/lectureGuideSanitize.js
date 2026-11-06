/**
 * 업로드한 강의 가이드 HTML 정화 + 마스킹 (브라우저 미리보기와 서버 저장이 같은 코드를 쓴다).
 *
 * 1) 정화: <script>, 인라인 이벤트(on*), javascript: 링크, iframe/object/embed/base 를 제거한다.
 *    (화면에서는 sandbox 로 스크립트 실행도 막는다 — 이쪽은 이중 방어)
 * 2) 마스킹: 사설 IP 를 문서용 대역(198.18.x.x)으로, okestro.cloud·추가 도메인을 example.com 으로 바꾼다.
 *    두 단계 모두 다시 적용해도 결과가 같다(멱등).
 */

export const MAX_GUIDE_HTML_BYTES = 4 * 1024 * 1024;
export const EXAMPLE_DOMAIN = 'example.com';
const BASE_DOMAINS = ['okestro.cloud'];

const OCTET = '(?:\\d{1,3}|x)';
const PRIVATE_IP = new RegExp(
  '(?<![\\d.])(?:' +
    `10(?:\\.${OCTET}){3}` +
    '|' +
    `172\\.(?:1[6-9]|2\\d|3[01])(?:\\.${OCTET}){2}` +
    '|' +
    `192\\.168(?:\\.${OCTET}){2}` +
    ')(?!\\d)(?!\\.\\d)',
  'g'
);

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 사용자가 입력한 추가 도메인 목록을 정리한다 (소문자, 호스트 형식만, 중복 제거). */
export function normalizeExtraDomains(input) {
  const raw = Array.isArray(input) ? input : String(input || '').split(/[\s,]+/);
  const seen = new Set();
  for (const item of raw) {
    const d = String(item || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/^\*\./, '')
      .replace(/^\.+|\.+$/g, '');
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) && d !== EXAMPLE_DOMAIN) seen.add(d);
  }
  return [...seen].slice(0, 20);
}

/** 정화: 실행 가능한 요소·속성 제거. report 에 제거 개수를 담는다. */
export function sanitizeGuideHtml(html) {
  const report = { scripts: 0, handlers: 0, jsLinks: 0, embeds: 0 };
  let out = String(html);

  out = out.replace(/<script\b[\s\S]*?<\/script\s*>/gi, () => (report.scripts++, ''));
  out = out.replace(/<script\b[^>]*>/gi, () => (report.scripts++, ''));

  out = out.replace(/<(iframe|object|embed|frame|frameset|applet)\b[\s\S]*?<\/\1\s*>/gi, () => (report.embeds++, ''));
  out = out.replace(/<(?:iframe|object|embed|frame|frameset|applet|base)\b[^>]*>/gi, () => (report.embeds++, ''));
  out = out.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh[^>]*>/gi, () => (report.embeds++, ''));

  const handler = /(<[a-zA-Z][^>]*?)\s+on[a-zA-Z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g;
  for (let guard = 0; guard < 1000; guard++) {
    let hit = false;
    out = out.replace(handler, (_m, tag) => ((hit = true), report.handlers++, tag));
    if (!hit) break;
  }

  out = out.replace(
    /(\b(?:href|src|xlink:href|action|formaction)\s*=\s*["']?)\s*javascript:[^"'\s>]*/gi,
    (_m, head) => (report.jsLinks++, `${head}#`)
  );

  return { html: out, report };
}

/** 마스킹: 사설 IP·내부 도메인 치환. changes 는 {kind, from, to, count} 목록. */
export function maskGuideHtml(html, { extraDomains = [] } = {}) {
  const counts = new Map();
  const note = (kind, from, to) => {
    const key = `${kind}\u0000${from}`;
    const cur = counts.get(key);
    if (cur) cur.count++;
    else counts.set(key, { kind, from, to, count: 1 });
  };

  let out = String(html);

  // 같은 /24 는 항상 같은 문서용 대역으로 바뀐다 (198.18.<n>.<마지막 자리>)
  const triples = new Map();
  out = out.replace(PRIVATE_IP, (match) => {
    const parts = match.split('.');
    if (parts.some((p) => p !== 'x' && Number(p) > 255)) return match;
    let to;
    if (parts[2] === 'x') {
      to = '198.18.x.x';
    } else {
      const key = parts.slice(0, 3).join('.');
      if (!triples.has(key)) triples.set(key, triples.size % 256);
      to = `198.18.${triples.get(key)}.${parts[3]}`;
    }
    note('ip', match, to);
    return to;
  });

  const domains = [...BASE_DOMAINS, ...normalizeExtraDomains(extraDomains)];
  for (const domain of domains) {
    const re = new RegExp(`(?<![a-zA-Z0-9-])((?:[a-zA-Z0-9-]+\\.)*)${escapeRegExp(domain)}(?![a-zA-Z0-9-])`, 'gi');
    out = out.replace(re, (match, subs) => {
      const first = subs ? subs.replace(/\.$/, '').split('.')[0].toLowerCase() : '';
      const to = first ? `${first}.${EXAMPLE_DOMAIN}` : EXAMPLE_DOMAIN;
      note('domain', match, to);
      return to;
    });
  }

  return { html: out, changes: [...counts.values()] };
}

/** 정화 → 마스킹 한 번에. */
export function processGuideHtml(html, options = {}) {
  const sanitized = sanitizeGuideHtml(html);
  const masked = maskGuideHtml(sanitized.html, options);
  return {
    html: masked.html,
    sizeBytes: new TextEncoder().encode(masked.html).length,
    sanitize: sanitized.report,
    changes: masked.changes,
  };
}

/** <title> 또는 첫 <h1> 에서 제목 후보를 뽑는다. */
export function guessGuideTitle(html) {
  const text = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (t && text(t[1])) return text(t[1]).slice(0, 120);
  const h = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  return h ? text(h[1]).slice(0, 120) : '';
}
