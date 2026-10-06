import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');
const IMPORT_RE = /(?:from|import)\s*\(?\s*'(\.[^']*)'/g;

/** api/* 서버리스 함수는 Node ESM 이라 상대 import 에 확장자가 필수다 (Vite 번들과 다름). */
function findExtensionlessImports(entry) {
  const seen = new Set();
  const bad = [];
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(IMPORT_RE)) {
      const spec = match[1];
      if (!/\.(m?js|json)$/.test(spec)) {
        bad.push(`${path.relative(ROOT, file)} -> ${spec}`);
        continue;
      }
      const target = path.resolve(path.dirname(file), spec);
      if (target.endsWith('.json') || !fs.existsSync(target)) continue;
      walk(target);
    }
  };
  walk(entry);
  return bad;
}

describe('api import chain', () => {
  const apiDir = path.join(ROOT, 'api');
  const entries = fs.readdirSync(apiDir).filter((name) => name.endsWith('.js'));

  it.each(entries)('%s has no extensionless relative imports', (name) => {
    expect(findExtensionlessImports(path.join(apiDir, name))).toEqual([]);
  });
});
