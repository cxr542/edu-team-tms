import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const EXCLUDE_DIR_PATTERNS = [
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)\.git(\/|$)/,
  /(^|\/)\.obsidian(\/|$)/,
  /(^|\/)dist(\/|$)/,
  /(^|\/)build(\/|$)/,
  /(^|\/)outputs(\/|$)/,
  /(^|\/)logs(\/|$)/,
  /(^|\/)backups-[^/]+(\/|$)/,
  /(^|\/)public\/docs(\/|$)/,
  /(^|\/)public\/tools(\/|$)/,
  /(^|\/)\.vercel\/output(\/|$)/,
];

const PRIMARY_DOCS = new Set([
  'README.md',
  'DESIGN.md',
  'docs/sot-map.md',
  'docs/ledger-live-sync.md',
  'docs/deployment-process.md',
]);

const KEYWORDS = [
  'Blob',
  'ledger',
  'journal',
  'localStorage',
  'snapshot',
  'static JSON',
  'Vercel',
  'GitHub Actions',
  'deploy',
  'push',
  'team share',
  '업무일지',
  'KPI',
  '향상 과제',
  'improve-projects',
  'mode=edit',
  'access=leader',
  'member',
];

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function isExcluded(relPath) {
  const posixPath = toPosix(relPath);
  return EXCLUDE_DIR_PATTERNS.some((re) => re.test(posixPath));
}

function walkMarkdownFiles(rootDir, dir = rootDir, acc = []) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = toPosix(path.relative(rootDir, full));
    if (isExcluded(rel)) continue;
    if (entry.isDirectory()) {
      walkMarkdownFiles(rootDir, full, acc);
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      acc.push(rel || entry.name);
    }
  }
  return acc;
}

function slugify(value, fallback = 'item') {
  const slug = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseHeadings(text) {
  const headings = [];
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!match) continue;
    headings.push({ level: match[1].length, text: cleanText(match[2]) });
  }
  return headings;
}

function parseFirstH1(text) {
  const headings = parseHeadings(text);
  const first = headings.find((h) => h.level === 1);
  return first ? first.text : '';
}

function normalizeUrl(value) {
  return String(value || '')
    .trim()
    .replace(/[)\].,;:!?]+$/g, '')
    .replace(/^<|>$/g, '');
}

function parseMarkdownLinks(text) {
  const links = [];
  const seen = new Set();
  const mdLinkRe = /\[[^\]]*?\]\(([^)]+)\)/g;
  const rawUrlRe = /\bhttps?:\/\/[^\s<>"')]+/g;
  const source = String(text || '');

  for (const match of source.matchAll(mdLinkRe)) {
    const target = normalizeUrl(match[1]);
    if (!target) continue;
    if (seen.has(target)) continue;
    seen.add(target);
    links.push(target);
  }

  for (const match of source.matchAll(rawUrlRe)) {
    const target = normalizeUrl(match[0]);
    if (!target) continue;
    if (seen.has(target)) continue;
    seen.add(target);
    links.push(target);
  }

  return links;
}

/**
 * Obsidian-style [[wikilink]] or [[path|label]]. Returns target paths (no label).
 * @param {string} text
 * @returns {string[]}
 */
export function parseWikilinks(text) {
  const links = [];
  const seen = new Set();
  const re = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
  const source = String(text || '');
  for (const match of source.matchAll(re)) {
    const target = cleanText(match[1]).replace(/\\/g, '/');
    if (!target || seen.has(target)) continue;
    seen.add(target);
    links.push(target);
  }
  return links;
}

/**
 * Resolve a wikilink target to a markdown document path in the vault index.
 * @param {string} target
 * @param {Map<string, string>} byKey lowercase key → rel path
 */
export function resolveWikilinkTarget(target, byKey) {
  const raw = cleanText(target).replace(/\\/g, '/').replace(/^\.\//, '');
  if (!raw) return null;
  const candidates = [
    raw,
    raw.endsWith('.md') ? raw : `${raw}.md`,
    raw.startsWith('docs/') ? raw : `docs/${raw}`,
    raw.startsWith('docs/') || raw.endsWith('.md') ? null : `docs/${raw}.md`,
  ].filter(Boolean);

  for (const c of candidates) {
    const hit = byKey.get(c.toLowerCase());
    if (hit) return hit;
  }

  const base = path.posix.basename(raw.replace(/\.md$/i, '')).toLowerCase();
  const baseHit = byKey.get(`basename:${base}`);
  return baseHit || null;
}

function buildPathIndex(markdownFiles) {
  /** @type {Map<string, string>} */
  const byKey = new Map();
  /** @type {Map<string, string[]>} */
  const byBasename = new Map();

  for (const relPath of markdownFiles) {
    const posix = toPosix(relPath);
    byKey.set(posix.toLowerCase(), posix);
    const noExt = posix.replace(/\.md$/i, '');
    byKey.set(noExt.toLowerCase(), posix);
    const base = path.posix.basename(noExt).toLowerCase();
    if (!byBasename.has(base)) byBasename.set(base, []);
    byBasename.get(base).push(posix);
  }

  for (const [base, paths] of byBasename) {
    if (paths.length === 1) {
      byKey.set(`basename:${base}`, paths[0]);
    } else {
      const docsPreferred = paths.find((p) => p.startsWith('docs/')) || paths[0];
      byKey.set(`basename:${base}`, docsPreferred);
    }
  }

  return byKey;
}

function extractKeywordHits(text) {
  const hits = [];
  const source = String(text || '');
  for (const keyword of KEYWORDS) {
    const pattern = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(pattern, 'gi');
    if (re.test(source)) hits.push(keyword);
  }
  return hits;
}

function sourceKindFor(relPath) {
  if (PRIMARY_DOCS.has(relPath)) return 'primary';
  if (relPath.startsWith('docs/reference-source/')) return 'reference-source';
  return 'supporting';
}

export function buildDocsGraph(rootDir, { now = new Date() } = {}) {
  const markdownFiles = walkMarkdownFiles(rootDir).sort((a, b) => a.localeCompare(b));
  const pathIndex = buildPathIndex(markdownFiles);
  const nodes = [];
  const edges = [];
  const documents = [];
  const nodeIds = new Set();
  const keywordIds = new Set();
  const urlIds = new Set();
  const edgeKeys = new Set();

  const addNode = (node) => {
    if (nodeIds.has(node.id)) return;
    nodeIds.add(node.id);
    nodes.push(node);
  };

  const addEdge = (edge) => {
    const key = `${edge.from}|${edge.to}|${edge.type}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push(edge);
  };

  for (const relPath of markdownFiles) {
    const absPath = path.join(rootDir, relPath);
    const text = readFileSync(absPath, 'utf8');
    const title = parseFirstH1(text) || path.basename(relPath);
    const headings = parseHeadings(text);
    const links = parseMarkdownLinks(text);
    const wikilinks = parseWikilinks(text);
    const keywords = extractKeywordHits(text);
    const sourceKind = sourceKindFor(relPath);

    addNode({
      id: relPath,
      type: 'document',
      title,
      path: relPath,
      sourceKind,
    });

    documents.push({
      id: relPath,
      path: relPath,
      title,
      sourceKind,
      headings,
      links,
      wikilinks,
      keywords,
    });

    for (const heading of headings) {
      const headingId = `${relPath}#${slugify(heading.text, `heading-${heading.level}`)}`;
      addNode({
        id: headingId,
        type: 'heading',
        title: heading.text,
        level: heading.level,
        path: relPath,
      });
      addEdge({
        from: relPath,
        to: headingId,
        type: 'documents',
      });
    }

    for (const target of links) {
      if (/^https?:\/\//i.test(target)) {
        const urlId = `url:${target}`;
        if (!urlIds.has(urlId)) {
          urlIds.add(urlId);
          addNode({
            id: urlId,
            type: 'url',
            label: target,
          });
        }
        addEdge({
          from: relPath,
          to: urlId,
          type: 'links_to',
        });
        continue;
      }

      // Relative markdown path → document edge when resolvable
      const resolvedMd = resolveWikilinkTarget(
        target.replace(/^\.\//, '').split('#')[0],
        pathIndex
      );
      if (resolvedMd && resolvedMd !== relPath) {
        addEdge({
          from: relPath,
          to: resolvedMd,
          type: 'links_to',
        });
      } else {
        const urlId = `url:${target}`;
        if (!urlIds.has(urlId)) {
          urlIds.add(urlId);
          addNode({
            id: urlId,
            type: 'url',
            label: target,
          });
        }
        addEdge({
          from: relPath,
          to: urlId,
          type: 'links_to',
        });
      }
    }

    for (const wiki of wikilinks) {
      const resolved = resolveWikilinkTarget(wiki, pathIndex);
      if (!resolved || resolved === relPath) continue;
      addEdge({
        from: relPath,
        to: resolved,
        type: 'links_to',
      });
    }

    for (const keyword of keywords) {
      const keywordId = `keyword:${slugify(keyword, 'keyword')}`;
      if (!keywordIds.has(keywordId)) {
        keywordIds.add(keywordId);
        addNode({
          id: keywordId,
          type: 'keyword',
          label: keyword,
        });
      }
      addEdge({
        from: relPath,
        to: keywordId,
        type: 'mentions',
      });
    }
  }

  const graph = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    documents,
    nodes,
    edges,
    summary: {
      documentCount: documents.length,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    },
  };
  return graph;
}

export function writeDocsGraph(rootDir, outPath, options = {}) {
  const graph = buildDocsGraph(rootDir, options);
  writeFileSync(outPath, `${JSON.stringify(graph, null, 2)}\n`);
  return graph;
}
