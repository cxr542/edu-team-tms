import { describe, expect, it } from 'vitest';
import { isHandledLocally, selectBulkApprovalTargets } from '../src/utils/kpiApprovalHandled.js';
import { kpi2RowId } from '../src/constants/kpiOperationalStore.js';

const kpi1Item = (over = {}) => ({
  type: 'KPI1',
  year: 2026,
  monthIndex: 5,
  member: { code: 'C' },
  submittedAt: '2026-07-02T06:54:03.208Z',
  ...over,
});
const store = (status, approvedAt) => ({
  months: { '2026-06': { C: { monthly01: { status, approvedAt } } } },
  kpi2RowStatus: {},
});

describe('isHandledLocally — 서버 목록에 남은 항목을 로컬 처리 상태로 걸러냄', () => {
  it('로컬에서 승인·반려했고 제출 이후이면 처리됨', () => {
    expect(isHandledLocally(kpi1Item(), store('승인', '2026-10-08T01:59:01.106Z'))).toBe(true);
    expect(isHandledLocally(kpi1Item(), store('반려', '2026-10-08T01:59:01.106Z'))).toBe(true);
  });

  it('로컬이 아직 제출·작성중이거나 기록이 없으면 처리 안 됨', () => {
    expect(isHandledLocally(kpi1Item(), store('제출', null))).toBe(false);
    expect(isHandledLocally(kpi1Item(), store('작성중', null))).toBe(false);
    expect(isHandledLocally(kpi1Item(), { months: {}, kpi2RowStatus: {} })).toBe(false);
    expect(isHandledLocally(kpi1Item(), null)).toBe(false);
  });

  it('반려 후 구성원이 다시 제출한 경우(제출이 처리보다 나중)는 다시 대기', () => {
    const resubmitted = kpi1Item({ submittedAt: '2026-10-09T00:00:00.000Z' });
    expect(isHandledLocally(resubmitted, store('반려', '2026-10-08T01:59:01.106Z'))).toBe(false);
  });

  it('제출 시각을 모르면 로컬 처리 결과를 신뢰, 처리 시각이 없으면 안 믿음', () => {
    expect(isHandledLocally(kpi1Item({ submittedAt: null }), store('승인', '2026-10-08T01:59:01.106Z'))).toBe(true);
    expect(isHandledLocally(kpi1Item(), store('승인', null))).toBe(false);
  });

  it('KPI2 효과 건', () => {
    const item = { type: 'KPI2', year: 2026, monthIndex: 7, member: { code: 'B' }, dayKey: '2026-08-03', taskId: 't1', submittedAt: '2026-08-04T00:00:00.000Z' };
    const s = { months: {}, kpi2RowStatus: { [kpi2RowId('B', '2026-08-03', 't1')]: { status: '승인', approvedAt: '2026-10-08T02:00:00.000Z' } } };
    expect(isHandledLocally(item, s)).toBe(true);
    expect(isHandledLocally({ ...item, taskId: 't2' }, s)).toBe(false);
  });

  it('KPI3(월간 역량)·기간 정보 없는 항목은 대상 아님', () => {
    expect(isHandledLocally({ type: 'KPI3', member: { code: 'A' } }, store('승인', '2026-10-08T01:59:01.106Z'))).toBe(false);
    expect(isHandledLocally({ type: 'KPI1', member: { code: 'C' } }, store('승인', '2026-10-08T01:59:01.106Z'))).toBe(false);
  });
});

describe('selectBulkApprovalTargets — 일괄 승인 대상', () => {
  it('KPI1·KPI2 만 포함, KPI3 는 제외', () => {
    const items = [{ type: 'KPI1' }, { type: 'KPI2' }, { type: 'KPI3' }, { type: 'KPI1' }];
    expect(selectBulkApprovalTargets(items).map((i) => i.type)).toEqual(['KPI1', 'KPI2', 'KPI1']);
    expect(selectBulkApprovalTargets()).toEqual([]);
  });
});
