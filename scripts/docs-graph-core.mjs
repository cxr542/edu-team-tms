import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const EXCLUDE_DIR_PATTERNS = [
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)\.git(\/|$)/,
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
  const nodes = [];
  const edges = [];
  const documents = [];
  const nodeIds = new Set();
  const keywordIds = new Set();
  const urlIds = new Set();

  const addNode = (node) => {
    if (nodeIds.has(node.id)) return;
    nodeIds.add(node.id);
    nodes.push(node);
  };

  const addEdge = (edge) => {
    edges.push(edge);
  };

  for (const relPath of markdownFiles) {
    const absPath = path.join(rootDir, relPath);
    const text = readFileSync(absPath, 'utf8');
    const title = parseFirstH1(text) || path.basename(relPath);
    const headings = parseHeadings(text);
    const links = parseMarkdownLinks(text);
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
