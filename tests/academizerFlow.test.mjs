import { describe, expect, it } from 'vitest';
import { FLOW_STEPS, fileKind, flowCurrent, formatBytes } from '../src/utils/academizerFlow.js';

describe('academizerFlow', () => {
  it('moves from upload to analysis to conversion to done', () => {
    const base = { file: null, wizardData: null, step: 1, lastResult: null };
    expect(flowCurrent(base)).toBe(0);
    expect(flowCurrent({ ...base, file: {} })).toBe(1);
    expect(flowCurrent({ ...base, file: {}, wizardData: {} })).toBe(2);
    expect(flowCurrent({ ...base, file: {}, wizardData: {}, step: 2 })).toBe(2);
    expect(flowCurrent({ ...base, file: {}, step: 2, lastResult: {} })).toBe(FLOW_STEPS.length);
  });

  it('tells html from pptx by extension', () => {
    expect(fileKind('가이드.HTML')).toBe('HTML');
    expect(fileKind('a.htm')).toBe('HTML');
    expect(fileKind('deck.pptx')).toBe('PPTX');
  });

  it('formats sizes', () => {
    expect(formatBytes(500)).toBe('1KB');
    expect(formatBytes(2048)).toBe('2KB');
    expect(formatBytes(3.5 * 1024 * 1024)).toBe('3.5MB');
    expect(formatBytes(NaN)).toBe('');
  });
});
