import { monthKey } from '../constants/kpiOperationalStore.js';
import {
  saveKpi2RowApprovalToSupabase,
  saveKpiMonthlyApprovalToSupabase,
} from './kpiOperationalSupabase.js';

function warnMirrorFailure(scope, result) {
  if (result?.ok || result?.status === 'disabled') return;
  console.warn(`[kpiOperational] ${scope} Supabase mirror failed: ${result.message}`);
}

export async function mirrorKpiMonthlyApprovalToSupabase({
  year,
  monthIndex,
  memberCode,
  monthly01,
  updatedAt,
}) {
  const result = await saveKpiMonthlyApprovalToSupabase({
    memberCode,
    yearMonth: monthKey(year, monthIndex),
    monthly01,
    updatedAt,
  });
  warnMirrorFailure('KPI1 monthly approval', result);
  return result;
}

export async function mirrorKpi2RowApprovalToSupabase({
  memberCode,
  dayKey,
  taskId,
  kpi2RowStatus,
  updatedAt,
}) {
  const result = await saveKpi2RowApprovalToSupabase({
    memberCode,
    dayKey,
    taskId,
    kpi2RowStatus,
    updatedAt,
  });
  warnMirrorFailure('KPI2 row approval', result);
  return result;
}
