import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeDocsGraph } from './docs-graph-core.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const outPath = path.join(repoRoot, 'docs/docs-graph.json');

const graph = writeDocsGraph(repoRoot, outPath);
process.stdout.write(
  `docs graph written: ${graph.summary.documentCount} documents, ${graph.summary.nodeCount} nodes, ${graph.summary.edgeCount} edges\n`
);
