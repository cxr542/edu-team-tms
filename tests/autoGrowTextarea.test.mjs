import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AutoGrowTextarea from '../src/components/AutoGrowTextarea.jsx';

describe('AutoGrowTextarea', () => {
  it('값과 최소 rows 를 유지하고 수동 리사이즈 대신 자동 높이를 쓴다', () => {
    const html = renderToString(
      React.createElement(AutoGrowTextarea, { value: '긴 내용\n둘째 줄', onChange: () => {}, className: 'form-input' })
    );
    expect(html).toContain('rows="2"');
    expect(html).toContain('긴 내용');
    expect(html).toContain('resize:none');
    expect(html).toContain('overflow:hidden');
  });
});
