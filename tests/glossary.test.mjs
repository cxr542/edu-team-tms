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

describe('MIG entry and auto-linker', () => {
  it('contains MIG (Multi-Instance GPU) seed entry', () => {
    const mig = GLOSSARY_SEED_ENTRIES.find((e) => e.slug === 'mig');
    expect(mig).toBeDefined();
    expect(mig.title).toBe('MIG (Multi-Instance GPU)');
    expect(mig.related).toContain('streaming-multiprocessor');
  });

  it('links streaming-multiprocessor to mig in seed', () => {
    const sm = GLOSSARY_SEED_ENTRIES.find((e) => e.slug === 'streaming-multiprocessor');
    expect(sm).toBeDefined();
    expect(sm.related).toContain('mig');
  });

  it('auto-links keywords in HTML text while avoiding code and tags', async () => {
    const { autoLinkGlossaryHtml, buildGlossaryKeywords } = await import('../src/utils/glossaryLinker.js');
    const sampleTerms = [
      { slug: 'mig', title: 'MIG (Multi-Instance GPU)' },
      { slug: 'streaming-multiprocessor', title: 'Streaming Multiprocessor (SM)' },
    ];

    const keywords = buildGlossaryKeywords(sampleTerms, 'streaming-multiprocessor');
    expect(keywords.some((k) => k.keyword === 'MIG' && k.slug === 'mig')).toBe(true);
    expect(keywords.some((k) => k.keyword === 'MIG(Multi-Instance GPU)' && k.slug === 'mig')).toBe(true);

    const inputHtml = '<p>자원 독립성: MIG(Multi-Instance GPU)나 vGPU 분할 시 쓰입니다. <code>MIG in code</code> 및 <a href="http://ex.com">기존 MIG 링크</a>는 유지됩니다.</p>';
    const outputHtml = autoLinkGlossaryHtml(inputHtml, sampleTerms, 'streaming-multiprocessor');

    expect(outputHtml).toContain('data-glossary-slug="mig"');
    expect(outputHtml).toContain('<a href="#mig" class="glossary-inline-link" data-glossary-slug="mig" title="MIG (Multi-Instance GPU) 바로가기">MIG(Multi-Instance GPU)</a>');
    expect(outputHtml).toContain('<code>MIG in code</code>');
    expect(outputHtml).toContain('<a href="http://ex.com">기존 MIG 링크</a>');
  });

  it('contains VMware VVF seed entry and extracts VVF acronym', async () => {
    const { buildGlossaryKeywords } = await import('../src/utils/glossaryLinker.js');
    const vvf = GLOSSARY_SEED_ENTRIES.find((e) => e.slug === 'vmware-vvf');
    expect(vvf).toBeDefined();
    expect(vvf.title).toBe('VMware VVF (VMware vSphere Foundation)');
    expect(vvf.tags).toContain('vmware');
    expect(vvf.related).toContain('vmware-vcf');

    const keywords = buildGlossaryKeywords([vvf], 'other-slug');
    expect(keywords.some((k) => k.keyword === 'VVF' && k.slug === 'vmware-vvf')).toBe(true);
    expect(keywords.some((k) => k.keyword === 'VMware VVF' && k.slug === 'vmware-vvf')).toBe(true);
  });

  it('contains VMware VCF seed entry and extracts VCF acronym', async () => {
    const { buildGlossaryKeywords } = await import('../src/utils/glossaryLinker.js');
    const vcf = GLOSSARY_SEED_ENTRIES.find((e) => e.slug === 'vmware-vcf');
    expect(vcf).toBeDefined();
    expect(vcf.title).toBe('VMware VCF (VMware Cloud Foundation)');
    expect(vcf.tags).toContain('vcf');
    expect(vcf.related).toContain('vmware-vvf');

    const keywords = buildGlossaryKeywords([vcf], 'other-slug');
    expect(keywords.some((k) => k.keyword === 'VCF' && k.slug === 'vmware-vcf')).toBe(true);
    expect(keywords.some((k) => k.keyword === 'VMware VCF' && k.slug === 'vmware-vcf')).toBe(true);
  });
});
