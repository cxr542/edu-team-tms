import { describe, expect, it } from 'vitest';
import {
  NAV_GROUP_DEFAULT_ORDER,
  applyNavOrder,
  diffNavLabels,
  moveNavItem,
  moveNavItemToEdge,
  sanitizeNavOrder,
  sanitizeNavSettings,
} from '../src/utils/navOrder.js';

describe('applyNavOrder', () => {
  const defaults = ['a', 'b', 'c', 'd'];

  it('keeps the default order when nothing is saved', () => {
    expect(applyNavOrder(defaults, undefined)).toEqual(defaults);
    expect(applyNavOrder(defaults, [])).toEqual(defaults);
  });

  it('puts the saved order first and appends menus that are not saved yet', () => {
    expect(applyNavOrder(defaults, ['c', 'a'])).toEqual(['c', 'a', 'b', 'd']);
  });

  it('drops menus that no longer exist and duplicates', () => {
    expect(applyNavOrder(defaults, ['x', 'b', 'b', 'a'])).toEqual(['b', 'a', 'c', 'd']);
  });
});

describe('moveNavItem', () => {
  it('moves an item up or down by one', () => {
    expect(moveNavItem(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveNavItem(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
  });

  it('does nothing at the ends or for an unknown id', () => {
    const order = ['a', 'b', 'c'];
    expect(moveNavItem(order, 'a', -1)).toBe(order);
    expect(moveNavItem(order, 'c', 1)).toBe(order);
    expect(moveNavItem(order, 'z', 1)).toBe(order);
  });
});

describe('sanitizeNavOrder', () => {
  it('keeps only known groups with string ids', () => {
    expect(sanitizeNavOrder({ common: ['ledger', 3], nope: ['x'], leader: 'kpi' })).toEqual({
      common: ['ledger'],
    });
    expect(sanitizeNavOrder(null)).toEqual({});
    expect(sanitizeNavOrder([])).toEqual({});
  });
});

describe('default order', () => {
  it('lists each admin menu exactly once', () => {
    const all = Object.values(NAV_GROUP_DEFAULT_ORDER).flat();
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('moveNavItemToEdge', () => {
  it('sends an item to the top or the bottom of its group', () => {
    expect(moveNavItemToEdge(['a', 'b', 'c', 'd'], 'c', 'top')).toEqual(['c', 'a', 'b', 'd']);
    expect(moveNavItemToEdge(['a', 'b', 'c', 'd'], 'b', 'bottom')).toEqual(['a', 'c', 'd', 'b']);
  });

  it('does nothing when it is already there or unknown', () => {
    const order = ['a', 'b', 'c'];
    expect(moveNavItemToEdge(order, 'a', 'top')).toBe(order);
    expect(moveNavItemToEdge(order, 'c', 'bottom')).toBe(order);
    expect(moveNavItemToEdge(order, 'z', 'top')).toBe(order);
  });
});

describe('sanitizeNavSettings / diffNavLabels', () => {
  it('keeps only known groups, known menu ids and trimmed names up to 40 chars', () => {
    expect(sanitizeNavSettings({ order: { leader: ['kpi'] }, labels: { kpi: '  KPI  ', x: 'no' } })).toEqual({
      order: { leader: ['kpi'] },
      labels: { kpi: 'KPI' },
    });
    expect(sanitizeNavSettings(null)).toEqual({ order: {}, labels: {} });
    expect(sanitizeNavSettings({ labels: [] })).toEqual({ order: {}, labels: {} });
  });

  it('diffs labels against the defaults so only renamed menus are shared', () => {
    const defaults = { ledger: '팀 빌딩 관리', kanban: '칸반 보드' };
    expect(diffNavLabels({ ledger: '팀 빌딩비', kanban: '칸반 보드' }, defaults)).toEqual({ ledger: '팀 빌딩비' });
    expect(diffNavLabels({}, defaults)).toEqual({});
  });
});
