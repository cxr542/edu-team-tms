import { describe, expect, it } from 'vitest';
import { marked } from 'marked';
import { escapeHtml, isSafeHref, renderSafeMarkdown } from '../src/utils/safeMarkdown.js';

describe('safeMarkdown', () => {
  it('인라인·블록 HTML은 렌더하지 않고 글자로 보여 준다', () => {
    const inline = renderSafeMarkdown('hi <img src=x onerror=alert(1)> there');
    expect(inline).not.toContain('<img');
    expect(inline).toContain('&lt;img src=x onerror=alert(1)&gt;');

    const block = renderSafeMarkdown('<script>alert(1)</script>\n\n본문');
    expect(block).not.toContain('<script');
    expect(block).toContain('<p>본문</p>');
  });

  it('마크다운 자체는 정상 렌더된다', () => {
    const html = renderSafeMarkdown('# 제목\n\n**굵게** `code`\n\n- a\n- b');
    expect(html).toContain('<h1>제목</h1>');
    expect(html).toContain('<strong>굵게</strong>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<li>a</li>');
  });

  it('javascript: 등 위험한 링크·이미지 URL은 #으로 바뀐다', () => {
    for (const md of [
      '[a](javascript:alert(1))',
      '[a](JavaScript:alert(1))',
      '[a](JaVa&#115;cript:alert(1))',
      '[a](javascript&#58;alert(1))',
      '[a](data:text/html,<b>x</b>)',
      '[a](vbscript:msgbox(1))',
    ]) {
      expect(renderSafeMarkdown(md)).toContain('<a href="#">');
    }
    expect(renderSafeMarkdown('![i](javascript:alert(1))')).toContain('<img src="#"');
  });

  it('정상 링크(https, mailto, 상대 slug, #앵커, /경로)는 그대로 둔다', () => {
    const html = renderSafeMarkdown(
      '[a](https://example.com/x?y=1&z=2) [b](mailto:a@b.c) [c](gpu-mig) [d](#sec) [e](/docs/x.md) [f](?slug=gpu)',
    );
    expect(html).toContain('href="https://example.com/x?y=1&z=2"');
    expect(html).toContain('href="mailto:a@b.c"');
    expect(html).toContain('href="gpu-mig"');
    expect(html).toContain('href="#sec"');
    expect(html).toContain('href="/docs/x.md"');
    expect(html).toContain('href="?slug=gpu"');
  });

  it('isSafeHref: 스킴 앞부분의 콜론·엔티티·공백·제어문자를 막는다', () => {
    expect(isSafeHref('')).toBe(true);
    expect(isSafeHref('java\tscript:alert(1)')).toBe(false);
    expect(isSafeHref('&#106;avascript:alert(1)')).toBe(false);
    expect(isSafeHref('a/b:c')).toBe(true);
  });

  it('escapeHtml', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#039;&amp;&#039;&lt;/a&gt;');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('전역 marked 설정을 바꾸지 않는다', () => {
    renderSafeMarkdown('<b>x</b>');
    expect(marked.parse('<b>x</b>')).toContain('<b>x</b>');
  });
});
