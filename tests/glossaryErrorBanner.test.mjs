import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import GlossaryErrorBanner from '../src/components/GlossaryErrorBanner.jsx';

const render = (props) => renderToStaticMarkup(createElement(GlossaryErrorBanner, props));

describe('GlossaryErrorBanner', () => {
  it('renders nothing without a message', () => {
    expect(render({})).toBe('');
    expect(render({ message: '' })).toBe('');
    expect(render({ message: null, onDismiss: () => {} })).toBe('');
  });

  it('shows the message as an accessible alert with a dismiss button', () => {
    const html = render({ message: '서버에 저장하지 못했습니다.', onDismiss: () => {} });
    expect(html).toContain('role="alert"');
    expect(html).toContain('서버에 저장하지 못했습니다.');
    expect(html).toContain('aria-label="오류 알림 닫기"');
    expect(html).toContain('class="glossary-alert"');
  });

  it('has no dismiss button when nothing can dismiss it, and escapes the message', () => {
    expect(render({ message: '실패' })).not.toContain('<button');
    const html = render({ message: '<img src=x onerror=alert(1)>' });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});

describe('glossary page wiring', () => {
  const page = readFileSync('src/pages/GlossaryPage.jsx', 'utf8');
  const hook = readFileSync('src/hooks/useGlossary.js', 'utf8');

  it('renders the hook error instead of dropping it', () => {
    expect(page).toContain('<GlossaryErrorBanner message={error} onDismiss={clearError} />');
    expect(hook).toMatch(/const clearError = useCallback\(\(\) => setError\(null\), \[\]\)/);
    expect(hook).toMatch(/sourceStatus,\s*clearError,/);
  });

  it('never announces success when the server did not save', () => {
    expect(page).toContain("const LOCAL_ONLY_TOAST = '서버에 저장하지 못했습니다. 이 브라우저에만 반영되었습니다.'");
    for (const ok of ['용어가 수정되었습니다.', '새 용어가 등록되었습니다.', '용어가 삭제되었습니다.', '초기 용어 데이터가 복원되었습니다.']) {
      expect(page).toContain(`res.warning ? LOCAL_ONLY_TOAST : '${ok}'`);
    }
  });

  it('returns the warning from every write so the page can react to it', () => {
    expect(hook).toContain('supabase: supabaseResult.ok, warning: createWarning');
    expect(hook).toContain('supabase: supabaseResult.ok, warning: updateWarning');
    expect(hook).toContain('return { ok: true, warning: deleteWarning }');
    expect(hook).toContain('return { ok: true, count: seed.length, warning }');
  });

  it('does not refresh away the warning after a failed seed restore', () => {
    expect(page).toContain('if (!res.warning) refresh();');
  });
});
