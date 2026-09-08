/**
 * Glossary Term Auto-linker & Keyword Resolution
 */

function escapeRegExp(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds candidate keywords from existing glossary terms, excluding currentSlug.
 * Sorted by length descending so longer compound phrases match first.
 */
export function buildGlossaryKeywords(terms, currentSlug) {
  if (!Array.isArray(terms) || terms.length === 0) return [];
  const keywordMap = [];
  const seenKeywords = new Set();

  for (const term of terms) {
    if (!term || !term.slug) continue;
    if (term.slug === currentSlug) continue;

    const candidates = new Set();
    if (term.title) {
      const fullTitle = term.title.trim();
      candidates.add(fullTitle);

      // Parentheses handling: e.g. "Streaming Multiprocessor (SM)" or "MIG (Multi-Instance GPU)"
      const parenMatch = fullTitle.match(/^(.*?)\s*\((.*?)\)$/);
      if (parenMatch) {
        const outer = parenMatch[1].trim();
        const inner = parenMatch[2].trim();
        if (outer.length >= 2) candidates.add(outer);
        if (inner.length >= 2) candidates.add(inner);
        if (outer.length >= 2 && inner.length >= 2) {
          candidates.add(`${outer}(${inner})`);
          candidates.add(`${inner}(${outer})`);
          candidates.add(`${inner} (${outer})`);
        }
      }

      // Check uppercase acronyms (e.g. VVF, SM, MIG, TKG, VCF)
      const acronyms = fullTitle.match(/\b[A-Z]{2,6}\b/g);
      if (acronyms) {
        acronyms.forEach((acr) => {
          if (!['AI', 'IT', 'UI', 'UX', 'TOP', 'ALL', 'THE', 'AND'].includes(acr)) {
            candidates.add(acr);
          }
        });
      }
    }

    for (const cand of candidates) {
      const lower = cand.toLowerCase();
      if (cand.length < 2) continue;
      // Skip generic words that shouldn't auto-link accidentally
      if (['ai', 'it', 'ui', 'ux', 'top', 'all', 'the', 'and', 'lab', '기본', '전체'].includes(lower)) continue;
      if (seenKeywords.has(lower)) continue;
      seenKeywords.add(lower);
      keywordMap.push({
        keyword: cand,
        slug: term.slug,
        title: term.title,
      });
    }
  }

  keywordMap.sort((a, b) => b.keyword.length - a.keyword.length);
  return keywordMap;
}

/**
 * Parses an HTML string and wraps unlinked glossary keywords with <a class="glossary-inline-link">.
 * Preserves text inside <a>, <code>, <pre>, <script>, <style>, and <h1> tags.
 */
export function autoLinkGlossaryHtml(html, terms, currentSlug) {
  if (!html || !terms || terms.length === 0) return html;
  const keywords = buildGlossaryKeywords(terms, currentSlug);
  if (keywords.length === 0) return html;

  const pattern = new RegExp(keywords.map((k) => escapeRegExp(k.keyword)).join('|'), 'g');
  const matchMap = new Map();
  keywords.forEach((k) => matchMap.set(k.keyword.toLowerCase(), k));

  // Split into tags and text tokens
  const parts = html.split(/(<[^>]+>)/g);
  let insideProtected = 0;
  const openTagRegex = /^<(a|code|pre|script|style|h1)\b/i;
  const closeTagRegex = /^<\/(a|code|pre|script|style|h1)>/i;

  const result = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i % 2 === 1) {
      // HTML tag
      if (openTagRegex.test(part) && !part.endsWith('/>')) {
        insideProtected++;
      } else if (closeTagRegex.test(part)) {
        insideProtected = Math.max(0, insideProtected - 1);
      }
      result.push(part);
    } else {
      // Text node
      if (insideProtected > 0 || !part) {
        result.push(part);
      } else {
        const replaced = part.replace(pattern, (matched) => {
          const item = matchMap.get(matched.toLowerCase());
          if (!item) return matched;
          return `<a href="#${item.slug}" class="glossary-inline-link" data-glossary-slug="${item.slug}" title="${item.title} 바로가기">${matched}</a>`;
        });
        result.push(replaced);
      }
    }
  }

  return result.join('');
}
