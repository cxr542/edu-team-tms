import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CompetencyRubricPanel from '../src/components/CompetencyRubricPanel.jsx';

const recordWith = (intLevel, extra = {}) => ({
  roleId: 'planner',
  self: { intLevel, dims: {}, evidence: '', dimEvidences: {}, dimLinks: {} },
  selfLocked: false,
  managerLocked: false,
  ...extra,
});

const render = (record, props = {}) =>
  renderToStaticMarkup(
    React.createElement(CompetencyRubricPanel, {
      side: 'self',
      record,
      readOnly: false,
      memberView: true,
      memberRole: '기획/운영',
      onUpdate: () => {},
      onLock: () => {},
      ...props,
    })
  );

const submitButton = (html) => /<button[^>]*competency-self-lock-btn[^>]*>/.exec(html)?.[0] ?? '';

describe('월별 레벨 자체평가 「팀장에게 제출」 버튼', () => {
  it('정수 레벨 미선택: 진짜 disabled 가 아니라 aria-disabled + 흐린 표시, 안내 문구 노출', () => {
    const html = render(recordWith(0));
    const btn = submitButton(html);
    expect(btn).not.toBe('');
    expect(btn).not.toMatch(/\sdisabled(=|\s|>)/); // 눌러도 반응 없는 disabled 상태가 아님
    expect(btn).toContain('aria-disabled="true"');
    expect(btn).toContain('is-needs-level');
    expect(btn).toContain('title="정수 레벨을 1~5 중에서 선택해야 제출할 수 있습니다."');
    expect(html).toContain('정수 레벨을 1~5 중에서 선택해 주세요.');
  });

  it('정수 레벨 선택됨: 일반 활성 버튼', () => {
    const btn = submitButton(render(recordWith(3)));
    expect(btn).toContain('aria-disabled="false"');
    expect(btn).not.toContain('is-needs-level');
    expect(btn).not.toMatch(/\sdisabled(=|\s|>)/);
  });

  it('제출 완료·읽기 전용이면 제출 버튼이 없다', () => {
    expect(submitButton(render(recordWith(3, { selfLocked: true })))).toBe('');
    expect(submitButton(render(recordWith(3), { readOnly: true }))).toBe('');
  });
});
