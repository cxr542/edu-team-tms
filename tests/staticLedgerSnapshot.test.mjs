import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('public/ledger-snapshot.json', () => {
  it('provides a non-empty static ledger fallback', () => {
    const filePath = path.join(process.cwd(), 'public/ledger-snapshot.json');
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    expect(Array.isArray(data.transactions)).toBe(true);
    expect(data.transactions.length).toBeGreaterThan(0);
    expect(Array.isArray(data.categories)).toBe(true);
    expect(data.categories.length).toBeGreaterThan(0);
    expect(data.publishedAt).toBeTruthy();
  });
});
