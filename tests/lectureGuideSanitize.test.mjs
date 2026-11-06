import { describe, expect, it } from 'vitest';
import {
  guessGuideTitle,
  maskGuideHtml,
  normalizeExtraDomains,
  processGuideHtml,
  sanitizeGuideHtml,
} from '../src/utils/lectureGuideSanitize.js';

describe('sanitizeGuideHtml', () => {
  it('removes scripts, inline handlers, javascript links and embeds', () => {
    const html =
      '<html><head><script>alert(1)</script><base href="//evil/"></head><body onload="x()">' +
      '<a href="javascript:alert(1)" onclick=\'y()\'>go</a><iframe src="//evil"></iframe>' +
      '<img src="a.png" onerror=boom()><p>keep</p></body></html>';
    const { html: out, report } = sanitizeGuideHtml(html);
    expect(out).not.toMatch(/<script|onload|onclick|onerror|javascript:|<iframe|<base/i);
    expect(out).toContain('<p>keep</p>');
    expect(out).toContain('<a href="#"');
    expect(report).toMatchObject({ scripts: 1, handlers: 3, jsLinks: 1, embeds: 2 });
  });
});

describe('maskGuideHtml', () => {
  it('maps private IPs to the documentation range, keeping the last octet and subnet grouping', () => {
    const { html, changes } = maskGuideHtml(
      'a 10.255.60.1 b 10.255.60.2 c 172.16.0.242:9443 d 192.168.1.5 e 10.255.60.x f 172.16.x.x g 8.8.8.8 h 10.2.1'
    );
    expect(html).toBe('a 198.18.0.1 b 198.18.0.2 c 198.18.1.242:9443 d 198.18.2.5 e 198.18.0.x f 198.18.x.x g 8.8.8.8 h 10.2.1');
    expect(changes.find((c) => c.from === '10.255.60.1')).toMatchObject({ to: '198.18.0.1', count: 1 });
  });

  it('does not touch version-like numbers or out-of-range octets', () => {
    const src = 'v10.1.2.3.4 and 10.300.1.1 and 172.32.0.1';
    expect(maskGuideHtml(src).html).toBe(src);
  });

  it('masks okestro.cloud and extra domains, keeping the first host label', () => {
    const { html } = maskGuideHtml('https://edu306.console.bf.okestro.cloud/x okestro.cloud lab.corp.test.net', {
      extraDomains: ['corp.test.net'],
    });
    expect(html).toBe('https://edu306.example.com/x example.com lab.example.com');
  });

  it('is idempotent', () => {
    const once = processGuideHtml('<p>10.255.60.1 edu.okestro.cloud <script>1</script></p>');
    const twice = processGuideHtml(once.html);
    expect(twice.html).toBe(once.html);
    expect(twice.changes).toHaveLength(0);
  });
});

describe('helpers', () => {
  it('normalizes extra domains', () => {
    expect(normalizeExtraDomains('https://Corp.Test.net/path, *.lab.test.org  bad_domain example.com')).toEqual([
      'corp.test.net',
      'lab.test.org',
    ]);
  });
  it('guesses a title from <title> then <h1>', () => {
    expect(guessGuideTitle('<title> A  guide </title><h1>x</h1>')).toBe('A guide');
    expect(guessGuideTitle('<h1>Only <b>H1</b></h1>')).toBe('Only H1');
  });
});
