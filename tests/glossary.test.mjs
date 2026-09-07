import { describe, expect, it } from 'vitest';
import { GLOSSARY_SEED_ENTRIES } from '../src/data/glossarySeedEntries.js';
import {
  normalizeGlossaryTerm,
  toRowPayload,
} from '../src/utils/glossarySupabase.js';
import { generateSlug } from '../src/hooks/useGlossary.js';
import { DEFAULT_NAV_LABELS, NAV_LABEL_IDS } from '../src/constants/navLabels.js';
import { TEAM_COMMON_MODULES } from '../src/constants/teamAccess.js';

describe('glossary seed entries', () => {
  it('contains at least 15 seed entries from AI-Synapse Wiki', () => {
    expect(GLOSSARY_SEED_ENTRIES.length).toBeGreaterThanOrEqual(15);
  });

  it('has unique slugs across all seed entries', () => {
    const slugs = GLOSSARY_SEED_ENTRIES.map((e) => e.slug);
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(slugs.length);
  });

  it('has title, body, and valid categories for every entry', () => {
    GLOSSARY_SEED_ENTRIES.forEach((entry) => {
      expect(entry.slug).toBeTruthy();
      expect(entry.title).toBeTruthy();
      expect(entry.body).toBeTruthy();
      expect(['topic', 'hub', 'story']).toContain(entry.category);
    });
  });
});

describe('glossary normalization and database payload', () => {
  it('normalizes raw row correctly', () => {
    const row = {
      slug: 'test-topic',
      title: '테스트 주제',
      category: 'topic',
      tags: ['ai', 'agent'],
      source_url: 'https://example.com',
      body: '# 테스트 본문',
      related: ['gemini'],
      visibility: 'published',
    };
    const norm = normalizeGlossaryTerm(row);
    expect(norm).not.toBeNull();
    expect(norm.slug).toBe('test-topic');
    expect(norm.title).toBe('테스트 주제');
    expect(norm.sourceUrl).toBe('https://example.com');
    expect(norm.tags).toEqual(['ai', 'agent']);
    expect(norm.related).toEqual(['gemini']);
  });

  it('normalizes JSON string tags and related fields', () => {
    const row = {
      slug: 'json-test',
      title: 'JSON 테스트',
      tags: JSON.stringify(['tag1', 'tag2']),
      related: JSON.stringify(['rel1']),
      body: '본문',
    };
    const norm = normalizeGlossaryTerm(row);
    expect(norm.tags).toEqual(['tag1', 'tag2']);
    expect(norm.related).toEqual(['rel1']);
  });

  it('generates a valid database row payload', () => {
    const term = {
      id: 'my-term',
      slug: 'my-term',
      title: '용어 제목',
      category: 'topic',
      tags: ['tagA'],
      sourceUrl: 'https://foo.com',
      body: '설명',
      related: [],
    };
    const payload = toRowPayload(term);
    expect(payload.slug).toBe('my-term');
    expect(payload.title).toBe('용어 제목');
    expect(payload.source_url).toBe('https://foo.com');
    expect(payload.tags).toEqual(['tagA']);
  });
});

describe('generateSlug', () => {
  it('generates clean slugs from English text', () => {
    expect(generateSlug('Google Gemini')).toBe('google-gemini');
    expect(generateSlug('Antigravity 2.0')).toBe('antigravity-20');
  });

  it('preserves Korean in slug when present', () => {
    expect(generateSlug('인공지능 모델')).toBe('인공지능-모델');
  });
});

describe('glossary navigation integration', () => {
  it('includes glossary in NAV_LABEL_IDS and DEFAULT_NAV_LABELS', () => {
    expect(NAV_LABEL_IDS).toContain('glossary');
    expect(DEFAULT_NAV_LABELS.glossary).toBe('용어사전');
  });

  it('includes glossary in TEAM_COMMON_MODULES', () => {
    expect(TEAM_COMMON_MODULES.has('glossary')).toBe(true);
  });
});
