import { kpi2LegacyRowId, kpi2RowId } from '../constants/kpiOperationalStore';
import { KPI_STATUS } from '../constants/kpiStatuses';
import { isKpi2EffectTask } from './computeTeamKpi';

function approvalStatusRank(status) {
  if (status === KPI_STATUS.APPROVED || status === KPI_STATUS.REJECTED) return 2;
  if (status === KPI_STATUS.SUBMITTED) return 1;
  return 0;
}

function approvalEventAt(record) {
  return record?.approvedAt || record?.submittedAt || null;
}

function timeValue(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function shouldUseIncomingApproval(existing, incoming) {
  if (!existing) return true;
  const incomingRank = approvalStatusRank(incoming?.status);
  const existingRank = approvalStatusRank(existing?.status);
  if (incomingRank !== existingRank) {
    return incomingRank > existingRank;
  }
  const incomingTime = timeValue(approvalEventAt(incoming));
  const existingTime = timeValue(approvalEventAt(existing));
  if (incomingTime !== null && existingTime !== null && incomingTime !== existingTime) {
    return incomingTime > existingTime;
  }
  if (incomingTime !== null && existingTime === null) return true;
  if (incomingTime === null && existingTime !== null) return false;
  return true;
}

/** 구성원 일지 백업 JSON에 포함할 KPI1/KPI2 승인 상태 */
export function extractMemberKpiApprovalSlice(kpiOperational, memberCode, days = {}) {
  if (!kpiOperational || !memberCode) {
    return { months: {}, kpi2RowStatus: {} };
  }

  const months = {};
  Object.entries(kpiOperational.months || {}).forEach(([ym, byMember]) => {
    const rec = byMember?.[memberCode];
    if (rec?.monthly01) {
      months[ym] = { monthly01: JSON.parse(JSON.stringify(rec.monthly01)) };
    }
  });

  const memberRowIds = new Set();
  Object.entries(days || {}).forEach(([dayKey, day]) => {
    (day.tasks || []).forEach((task) => {
      if (!task?.id || !isKpi2EffectTask(task)) return;
      memberRowIds.add(kpi2RowId(memberCode, dayKey, task.id));
      memberRowIds.add(kpi2LegacyRowId(dayKey, task.id));
    });
  });

  const kpi2RowStatus = {};
  Object.entries(kpiOperational.kpi2RowStatus || {}).forEach(([id, meta]) => {
    if (memberRowIds.has(id)) {
      kpi2RowStatus[id] = { ...meta };
    }
  });

  return { months, kpi2RowStatus };
}

/** 백업 가져오기 시 구성원별 승인 상태를 operational store에 병합 */
export function mergeMemberKpiApprovalIntoStore(store, memberCode, slice) {
  if (!slice || !memberCode) return store;

  let next = { ...store };
  const monthsIn = slice.months || {};
  if (Object.keys(monthsIn).length) {
    const months = { ...next.months };
    Object.entries(monthsIn).forEach(([ym, rec]) => {
      if (!rec?.monthly01) return;
      const month = { ...(months[ym] || {}) };
      const existing = month[memberCode]?.monthly01;
      const incoming = rec.monthly01;
      if (shouldUseIncomingApproval(existing, incoming)) {
        month[memberCode] = { monthly01: { ...incoming } };
      }
      months[ym] = month;
    });
    next = { ...next, months };
  }

  const statusIn = slice.kpi2RowStatus || {};
  if (Object.keys(statusIn).length) {
    const kpi2RowStatus = { ...next.kpi2RowStatus };
    Object.entries(statusIn).forEach(([id, meta]) => {
      const [part1, part2, part3] = String(id).split('|');
      const scopedId = part3 ? id : kpi2RowId(memberCode, part1, part2);
      const existing = kpi2RowStatus[scopedId];
      if (shouldUseIncomingApproval(existing, meta)) {
        kpi2RowStatus[scopedId] = { ...meta };
      }
    });
    next = { ...next, kpi2RowStatus };
  }

  return next;
}

export function mergeJournalKpiApprovalImport(kpiOperationalStore, snapshot) {
  if (!snapshot?.memberJournals) return kpiOperationalStore;

  let next = kpiOperationalStore;
  Object.entries(snapshot.memberJournals).forEach(([memberCode, slice]) => {
    if (!slice?.kpiApproval) return;
    next = mergeMemberKpiApprovalIntoStore(next, memberCode, slice.kpiApproval);
  });
  return next;
}
