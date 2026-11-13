import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import NavLabelsModal, { describeSharedStatus } from '../src/components/NavLabelsModal.jsx';
import { DEFAULT_NAV_LABELS } from '../src/constants/navLabels.js';
import { NAV_GROUP_DEFAULT_ORDER, applyNavOrder } from '../src/utils/navOrder.js';

function render(shared) {
  return renderToStaticMarkup(
    React.createElement(NavLabelsModal, {
      isOpen: true,
      onClose: vi.fn(),
      labels: DEFAULT_NAV_LABELS,
      defaults: DEFAULT_NAV_LABELS,
      onSave: vi.fn(),
      onReset: vi.fn(),
      orderOf: (group) => applyNavOrder(NAV_GROUP_DEFAULT_ORDER[group] || [], undefined),
      onMove: vi.fn(),
      onMoveEdge: vi.fn(),
      shared,
    }),
  );
}

describe('NavLabelsModal', () => {
  it('gives every orderable menu top / up / down / bottom buttons', () => {
    const html = render({ status: 'ready', at: null, message: '' });
    expect(html).toContain('AI 사무실 맨 위로');
    expect(html).toContain('AI 사무실 위로');
    expect(html).toContain('AI 사무실 아래로');
    expect(html).toContain('AI 사무실 맨 아래로');
    const orderable = Object.values(NAV_GROUP_DEFAULT_ORDER).flat().length;
    expect((html.match(/맨 위로"/g) || []).length).toBeGreaterThanOrEqual(orderable);
  });

  it('shows the shared-save status line', () => {
    expect(render({ status: 'saved', at: null, message: '' })).toContain('팀 공유로 저장됐어요');
    expect(render({ status: 'not-ready', at: null, message: '' })).toContain('이 브라우저에만 저장돼요');
  });
});

describe('describeSharedStatus', () => {
  it('maps each status to a tone and a sentence', () => {
    expect(describeSharedStatus({ status: 'loading' }).tone).toBe('muted');
    expect(describeSharedStatus({ status: 'saving' }).text).toContain('저장 중');
    expect(describeSharedStatus({ status: 'saved', at: '2026-11-13T05:00:00.000Z' }).tone).toBe('ok');
    expect(describeSharedStatus({ status: 'empty' }).text).toContain('아직 공유된 설정이 없어요');
    expect(describeSharedStatus({ status: 'not-ready' }).tone).toBe('warn');
    const err = describeSharedStatus({ status: 'error', message: '응답 형식이 올바르지 않아요' });
    expect(err.tone).toBe('warn');
    expect(err.text).toContain('응답 형식이 올바르지 않아요');
  });
});
