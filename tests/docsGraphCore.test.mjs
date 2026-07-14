import { describe, expect, it } from 'vitest';
import {
  parseWikilinks,
  resolveWikilinkTarget,
} from '../scripts/docs-graph-core.mjs';

describe('docs-graph wikilinks', () => {
  it('parses [[wikilink]] and [[path|label]]', () => {
    expect(parseWikilinks('see [[sot-map]] and [[j8-journal-supabase-auto-upload-plan|J8]]')).toEqual([
      'sot-map',
      'j8-journal-supabase-auto-upload-plan',
    ]);
  });

  it('resolves basename and docs/ paths', () => {
    const byKey = new Map([
      ['docs/sot-map.md', 'docs/sot-map.md'],
      ['docs/sot-map', 'docs/sot-map.md'],
      ['basename:sot-map', 'docs/sot-map.md'],
      ['agents.md', 'AGENTS.md'],
      ['agents', 'AGENTS.md'],
      ['basename:agents', 'AGENTS.md'],
    ]);
    expect(resolveWikilinkTarget('sot-map', byKey)).toBe('docs/sot-map.md');
    expect(resolveWikilinkTarget('AGENTS', byKey)).toBe('AGENTS.md');
    expect(resolveWikilinkTarget('docs/sot-map', byKey)).toBe('docs/sot-map.md');
  });
});
