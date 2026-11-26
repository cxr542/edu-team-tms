import { TEAM_KPI_MEMBERS, findKpiMember } from '../constants/kpiMembers.js';
import { KPI_STATUS } from '../constants/kpiStatuses.js';
import { buildKpi02EffectRows } from './computeTeamKpi.js';
import { listSubmittedKpiApprovalRowsFromSupabase } from './kpiOperationalSupabaseReads.js';
import { KPI1_NAME, KPI2_NAME } from '../constants/kpiDisplayNames.js';

const MEMBER_ORDER = Object.fromEntries(TEAM_KPI_MEMBERS.map((member, index) => [member.code, index]));

function memberOrder(code) {
  const order = MEMBER_ORDER[code];
  return Number.isInteger(order) ? order : TEAM_KPI_MEMBERS.length;
}

function memberForCode(memberCode) {
  return findKpiMember(memberCode) || { code: memberCode, displayName: memberCode, role: '' };
}

function formatMonthLabel(monthIndex) {
  return `${monthIndex + 1}월`;
}

function buildKpi1PendingItem(year, monthIndex, row) {
  const member = memberForCode(row.member_code);
  return {
    type: 'KPI1',
    year,
    monthIndex,
    member,
    label: `${member.displayName} · ${formatMonthLabel(monthIndex)} ${KPI1_NAME} · 승인 요청`,
    submittedAt: row.submitted_at || row.monthly01?.submittedAt || null,
  };
}

function resolveLocalKpi2Row({
  year,
  monthIndex,
  improveProjects,
  getMemberDays,
  memberCode,
  dayKey,
  taskId,
}) {
  const days = getMemberDays(memberCode);
  const rows = buildKpi02EffectRows(year, monthIndex, days, improveProjects, memberCode, {});
  return rows.find((row) => row.dayKey === dayKey && row.taskId === taskId) || null;
}

function buildKpi2PendingItem({
  year,
  monthIndex,
  improveProjects,
  getMemberDays,
  row,
}) {
  const member = memberForCode(row.member_code);
  const localRow = resolveLocalKpi2Row({
    year,
    monthIndex,
    improveProjects,
    getMemberDays,
    memberCode: member.code,
    dayKey: row.day_key,
    taskId: row.task_id,
  });
  const taskLabel = localRow?.업무명 || row.task_id;
  const submittedAt = row.submitted_at || row.kpi2_row_status?.submittedAt || null;
  const approvedAt = row.approved_at || row.kpi2_row_status?.approvedAt || null;
  const approver = row.approver || row.kpi2_row_status?.approver || '';
  const rejectReason = row.reject_reason || row.kpi2_row_status?.rejectReason || '';
  const status = row.status || KPI_STATUS.SUBMITTED;

  return {
    type: 'KPI2',
    year,
    monthIndex,
    member,
    dayKey: row.day_key,
    taskId: row.task_id,
    label: `${member.displayName} · ${KPI2_NAME} · ${taskLabel} · 승인 요청`,
    submittedAt,
    row: localRow
      ? {
          ...localRow,
          상태: status,
          승인자: approver,
          승인일: approvedAt ? String(approvedAt).slice(0, 10) : '',
          rejectReason,
        }
      : {
          dayKey: row.day_key,
          taskId: row.task_id,
          구성원: member.code,
          업무명: taskLabel,
          상태: status,
          코멘트: '',
          승인자: approver,
          승인일: approvedAt ? String(approvedAt).slice(0, 10) : '',
          rejectReason,
        },
  };
}

export function buildAdminKpiPendingApprovalItemsFromSupabaseRows({
  year,
  monthIndex,
  monthlyApprovals = [],
  kpi2RowApprovals = [],
  getMemberDays,
  improveProjects,
}) {
  const items = [
    ...monthlyApprovals.map((row) => buildKpi1PendingItem(year, monthIndex, row)),
    ...kpi2RowApprovals.map((row) =>
      buildKpi2PendingItem({ year, monthIndex, improveProjects, getMemberDays, row })
    ),
  ];

  return items.sort((a, b) => {
    const memberDelta = memberOrder(a.member.code) - memberOrder(b.member.code);
    if (memberDelta !== 0) return memberDelta;
    if (a.type !== b.type) return a.type === 'KPI1' ? -1 : 1;
    if (a.type === 'KPI2' && b.type === 'KPI2') {
      return String(a.dayKey).localeCompare(String(b.dayKey)) || String(a.taskId).localeCompare(String(b.taskId));
    }
    return 0;
  });
}

export async function loadAdminKpiPendingApprovals({
  year,
  monthIndex,
  getMemberDays,
  improveProjects,
  fallbackPendingApprovals = () => [],
}) {
  const supabaseResult = await listSubmittedKpiApprovalRowsFromSupabase({ year, monthIndex });
  if (supabaseResult.status === 'disabled' || supabaseResult.status === 'error') {
    return {
      ...supabaseResult,
      source: 'localStorage',
      data: fallbackPendingApprovals(),
    };
  }
  if (supabaseResult.status === 'empty') {
    const localPendingApprovals = fallbackPendingApprovals();
    if (localPendingApprovals.length > 0) {
      return {
        ...supabaseResult,
        source: 'localStorage',
        data: localPendingApprovals,
      };
    }
  }

  const supabaseItems = buildAdminKpiPendingApprovalItemsFromSupabaseRows({
    year,
    monthIndex,
    monthlyApprovals: supabaseResult.data?.monthlyApprovals || [],
    kpi2RowApprovals: supabaseResult.data?.kpi2RowApprovals || [],
    getMemberDays,
    improveProjects,
  });
  // 서버 승인 테이블에는 KPI1·KPI2만 있다. KPI3(역량 팀장 확정 요청)는 로컬 목록에서만 나오므로 합친다.
  // 빼면 그 달에 서버 행이 하나라도 있을 때 KPI3 요청이 화면에서 사라지고 배지 숫자와 어긋난다.
  const localKpi3Items = (fallbackPendingApprovals() || []).filter((item) => item?.type === 'KPI3');
  const items = [...supabaseItems, ...localKpi3Items];

  return {
    ...supabaseResult,
    source: 'supabase',
    data: items,
  };
}
