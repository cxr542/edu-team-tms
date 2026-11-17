import { Marked } from 'marked';

/**
 * Markdown → HTML for content we inject with innerHTML (glossary bodies, reference docs).
 * - Raw HTML in the source is shown as text, never rendered.
 * - Link/image URLs are limited to http(s), mailto and relative/anchor URLs.
 * Uses its own Marked instance so it does not depend on (or change) the global `marked` config.
 */

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const ALLOWED_SCHEME = /^(https?|mailto):/i;

/** True for http(s)/mailto URLs and scheme-less relative URLs (`slug`, `#id`, `/path`, `?q`). */
export function isSafeHref(href) {
  const value = String(href ?? '').trim();
  if (!value) return true;
  if (ALLOWED_SCHEME.test(value)) return true;
  // Anything before the first / ? # must not be able to form a scheme,
  // including entity-encoded (`&#58;`) or whitespace/control-split (`java\tscript:`) ones.
  const head = value.split(/[/?#]/, 1)[0];
  // eslint-disable-next-line no-control-regex
  return !/[:&\\\u0000- \u007f]/.test(head);
}

const safeMarked = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
  },
  walkTokens(token) {
    if ((token.type === 'link' || token.type === 'image') && !isSafeHref(token.href)) {
      token.href = '#';
    }
  },
});

export function renderSafeMarkdown(markdown) {
  return safeMarked.parse(String(markdown ?? ''));
}
