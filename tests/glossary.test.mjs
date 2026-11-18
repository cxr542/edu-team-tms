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
    expect(payload.source).toBe('https://foo.com');
    expect(payload.markdown).toBe('설명');
    expect(payload.tags).toEqual(['tagA']);
  });

  it('maps the real production column names (markdown/related_terms/source)', () => {
    const row = {
      slug: 'prod-shape',
      title: '프로덕션 컬럼 테스트',
      category: 'topic',
      tags: ['tag1'],
      source: 'https://prod.example.com',
      markdown: '실제 프로덕션 컬럼으로 저장된 본문',
      related_terms: ['other-term'],
    };
    const norm = normalizeGlossaryTerm(row);
    expect(norm.sourceUrl).toBe('https://prod.example.com');
    expect(norm.body).toBe('실제 프로덕션 컬럼으로 저장된 본문');
    expect(norm.related).toEqual(['other-term']);

    const payload = toRowPayload(norm);
    expect(payload.source).toBe('https://prod.example.com');
    expect(payload.markdown).toBe('실제 프로덕션 컬럼으로 저장된 본문');
    expect(payload.related_terms).toEqual(['other-term']);
    expect(payload).not.toHaveProperty('body');
    expect(payload).not.toHaveProperty('related');
    expect(payload).not.toHaveProperty('source_url');
    expect(payload).not.toHaveProperty('visibility');
    expect(payload).not.toHaveProperty('author');
    expect(payload).not.toHaveProperty('author_code');
  });

  it('never sends null for source (NOT NULL column, no source URL entered)', () => {
    const payload = toRowPayload({
      id: 'no-source',
      slug: 'no-source',
      title: '출처 없는 용어',
      category: 'topic',
      tags: [],
      sourceUrl: null,
      body: '본문',
      related: [],
    });
    expect(payload.source).toBe('');
    expect(payload.source).not.toBeNull();
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

  it('auto-link does not match an English acronym inside a longer English word', async () => {
    const { autoLinkGlossaryHtml } = await import('../src/utils/glossaryLinker.js');
    const terms = [
      { slug: 'vm-migration', title: 'VM 마이그레이션' },
      { slug: 'vm', title: 'VM (Virtual Machine)' },
      { slug: 'virtualization', title: '가상화' },
    ];
    const out = autoLinkGlossaryHtml(
      '<p>VMware(Broadcom), VMs, 2VM 은 그대로. VM 마이그레이션, VM이, (VM) 및 서버 가상화를 쓴다.</p>',
      terms,
      'other',
    );
    const linked = [...out.matchAll(/data-glossary-slug="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => `${m[2]}→${m[1]}`);

    expect(out).toContain('VMware(Broadcom), VMs, 2VM 은 그대로.');
    expect(linked).toEqual([
      'VM 마이그레이션→vm-migration',
      'VM→vm',
      'VM→vm',
      '가상화→virtualization',
    ]);
  });

  it('auto-link escapes term slug and title inside link attributes', async () => {
    const { autoLinkGlossaryHtml } = await import('../src/utils/glossaryLinker.js');
    const terms = [{ slug: 'bad"><img src=x onerror=alert(1)>', title: 'BAD (Bad" onmouseover="alert`1` & <b>)' }];
    const out = autoLinkGlossaryHtml('<p>BAD 테스트</p>', terms, 'other');

    expect(out).not.toContain('<img');
    expect(out).not.toContain('<b>');
    expect(out).not.toContain('onmouseover="');
    expect(out).toContain('title="BAD (Bad&quot; onmouseover=&quot;alert`1` &amp; &lt;b&gt;) 바로가기"');

    expect(out).toContain('data-glossary-slug="bad&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"');
    expect(out).toMatch(/>BAD<\/a> 테스트<\/p>$/);
  });

  it('uses an acronym as a keyword only when it names the term itself', async () => {
    const { buildGlossaryKeywords } = await import('../src/utils/glossaryLinker.js');
    const terms = [
      { slug: 'mig', title: 'MIG (Multi-Instance GPU)' },
      { slug: 'antigravity-cli', title: 'Antigravity CLI' },
      { slug: 'llm-marketing-pipeline', title: 'LLM 에이전트를 활용한 마케팅 콘텐츠 무한 생성 파이프라인 수립기' },
      { slug: 'vm-migration', title: 'VM 마이그레이션' },
      { slug: 'vmware', title: 'VM웨어' },
      { slug: 'vpa-recommendation', title: 'VPA Recommendation' },
      { slug: 'ms-azure', title: 'MS Azure' },
      { slug: 'hpe', title: 'HPE(HP Enterprise)' },
      { slug: 'vmware-vvf', title: 'VMware VVF (VMware vSphere Foundation)' },
      { slug: 'vmware-vcf', title: 'VMware VCF (VMware Cloud Foundation)' },
      { slug: 'hpa', title: 'HPA (Horizontal Pod Autoscaler)' },
      { slug: 'aws', title: 'AWS' },
    ];
    const bySlug = (keyword) => buildGlossaryKeywords(terms, 'other').find((k) => k.keyword === keyword)?.slug;

    for (const word of ['GPU', 'CLI', 'LLM', 'VM', 'VPA', 'MS', 'HP']) {
      expect(bySlug(word)).toBeUndefined();
    }
    expect(bySlug('MIG')).toBe('mig');
    expect(bySlug('VVF')).toBe('vmware-vvf');
    expect(bySlug('VCF')).toBe('vmware-vcf');
    expect(bySlug('HPA')).toBe('hpa');
    expect(bySlug('HPE')).toBe('hpe');
    expect(bySlug('AWS')).toBe('aws');
    expect(bySlug('Antigravity CLI')).toBe('antigravity-cli');
    expect(bySlug('VM 마이그레이션')).toBe('vm-migration');
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
    expect(vcf.related).toContain('sns');

    const keywords = buildGlossaryKeywords([vcf], 'other-slug');
    expect(keywords.some((k) => k.keyword === 'VCF' && k.slug === 'vmware-vcf')).toBe(true);
    expect(keywords.some((k) => k.keyword === 'VMware VCF' && k.slug === 'vmware-vcf')).toBe(true);
  });

  it('contains SnS seed entry and extracts SnS and S&S keywords', async () => {
    const { buildGlossaryKeywords } = await import('../src/utils/glossaryLinker.js');
    const sns = GLOSSARY_SEED_ENTRIES.find((e) => e.slug === 'sns');
    expect(sns).toBeDefined();
    expect(sns.title).toBe('SnS (Subscription and Support)');
    expect(sns.tags).toContain('subscription');
    expect(sns.related).toContain('vmware-vvf');
    expect(sns.related).toContain('vmware-vcf');

    const keywords = buildGlossaryKeywords([sns], 'other-slug');
    expect(keywords.some((k) => k.keyword === 'SnS' && k.slug === 'sns')).toBe(true);
    expect(keywords.some((k) => k.keyword === 'S&S' && k.slug === 'sns')).toBe(true);
    expect(keywords.some((k) => k.keyword === 'Subscription and Support' && k.slug === 'sns')).toBe(true);
  });

  it('contains Kubernetes scaling and VPA recommendation seed entries', () => {
    const scale = GLOSSARY_SEED_ENTRIES.find((e) => e.slug === 'scale-in-out-up-down');
    const vpa = GLOSSARY_SEED_ENTRIES.find((e) => e.slug === 'vpa-recommendation');
    const hpaTerm = GLOSSARY_SEED_ENTRIES.find((e) => e.slug === 'hpa');
    const vpaTerm = GLOSSARY_SEED_ENTRIES.find((e) => e.slug === 'vpa');
    expect(scale).toBeDefined();
    expect(vpa).toBeDefined();
    expect(hpaTerm.related).toContain('vpa');
    expect(vpaTerm.related).toContain('hpa');
    expect(scale.related).toEqual(expect.arrayContaining(['hpa', 'vpa']));
    expect(scale.related).toContain('vpa-recommendation');
    expect(vpa.related).toContain('scale-in-out-up-down');
    ['target', 'uncappedTarget', 'lowerBound', 'upperBound'].forEach((field) => {
      expect(vpa.body).toContain(field);
    });
  });
});
