/**
 * KPI3(지표3) 평가 데모 — 2026년 2분기 · Academizer 일지 시나리오와 연계
 * - competencyMonths: 4~6월 월간 루브릭(자체·팀장 확정)
 * - quarters: 1Q(전분기 다면 참고) + 2Q(4요소·종합)
 */
import { TEAM_KPI_MEMBERS } from '../constants/kpiMembers';
import {
  accumulationOrderForRole,
  DIM_MET,
  DIM_UNMET,
  mapMemberRoleToCompetency,
} from '../constants/competencyRubric';
import { defaultDmDetail, defaultLeaderDetail, defaultPracticeDetail } from '../constants/kpi3Elements';
import { computeCompetencyEval } from '../utils/competencyScore';
import { computeKpi3Composite, gradeKpi3 } from '../utils/kpiGrades';
import { DM_DUAL_DEFAULT_LECTURE_PCT, DM_PROFILE, DM_WEIGHT_MODE_MANUAL } from '../constants/kpi3DmProfile';
import { computeDmScore, computeLeaderScore, computePracticeScore } from '../utils/kpi3ElementScores';

export const KPI3_DEMO_YEAR = 2026;
/** 6월 (0-based 5) — URL month=6 과 동일 */
export const KPI3_DEMO_MONTH_INDEX = 5;

const Q2_MONTHS = ['2026-04', '2026-05', '2026-06'];

function dimsFromMetCount(roleId, metCount) {
  const order = accumulationOrderForRole(roleId);
  const dims = Object.fromEntries(order.map((id) => [id, DIM_UNMET]));
  for (let i = 0; i < Math.min(metCount, order.length); i += 1) {
    dims[order[i]] = DIM_MET;
  }
  return dims;
}

function buildEvalSide(intLevel, metCount, roleId) {
  const dims = dimsFromMetCount(roleId, metCount);
  const computed = computeCompetencyEval({ intLevel, dims, roleId });
  return { intLevel, dims, computed };
}

function buildCompetencyMonth(memberCode, { intLevel, selfMet, mgrInt, mgrMet, selfLocked = true, managerLocked = true }) {
  const member = TEAM_KPI_MEMBERS.find((m) => m.code === memberCode);
  const roleId = mapMemberRoleToCompetency(member?.role);
  const self = buildEvalSide(intLevel, selfMet, roleId);
  const manager = buildEvalSide(mgrInt ?? intLevel, mgrMet ?? selfMet, roleId);
  return {
    roleId,
    self,
    manager,
    selfLocked,
    managerLocked,
    updatedAt: '2026-06-04T09:00:00.000Z',
  };
}

function finalizeQuarterRecord({ level, dm, leader, practice, levelAuto = false, locked = false, dmDetail, leaderDetail, practiceDetail, memos = [] }) {
  const quarter = {
    level,
    dm,
    leader,
    practice,
    levelAuto,
    locked,
    confirmedAt: locked ? '2026-06-04T10:00:00.000Z' : null,
  };
  quarter.composite = computeKpi3Composite(quarter);
  quarter.grade = gradeKpi3(quarter.composite);
  return {
    memos,
    quarter,
    dmDetail: dmDetail || defaultDmDetail(),
    leaderDetail: leaderDetail || defaultLeaderDetail(),
    practiceDetail: practiceDetail || defaultPracticeDetail(),
  };
}

/** @param {string} memberCode */
function memberScenario(memberCode) {
  if (memberCode === 'A') {
    const dmDetail = { lectureAvg: '4.25', lectureN: '6', opsAvg: '4.0', opsN: '4', note: '2Q 강의·운영 만족도 (데모)' };
    const leaderDetail = { memberSelf: '3.4', managerScore: '3.8', note: 'KPI1·2 B~A 구간' };
    const practiceDetail = {
      cases: [
        { id: 'pa1', text: 'Academizer 강의안 표준 템플릿 현장 적용', approved: true, at: '2026-04-10' },
        { id: 'pa2', text: '6월 시나리오 강의 파일럿 코칭', approved: true, at: '2026-06-12' },
      ],
    };
    const dm = computeDmScore(dmDetail, { dmProfile: DM_PROFILE.INSTRUCTOR }).score ?? 4.25;
    const leader = computeLeaderScore(leaderDetail) ?? 3.64;
    const practice = computePracticeScore(practiceDetail) ?? 4;
    const level = 3.6;
    return {
      competencyByMonth: [
        { ym: '2026-04', ...buildCompetencyMonth('A', { intLevel: 3, selfMet: 3, mgrMet: 4 }) },
        { ym: '2026-05', ...buildCompetencyMonth('A', { intLevel: 3, selfMet: 4, mgrMet: 4 }) },
        { ym: '2026-06', ...buildCompetencyMonth('A', { intLevel: 4, selfMet: 4, mgrMet: 5 }) },
      ],
      q1: finalizeQuarterRecord({
        level: 3.4,
        dm: 3.85,
        leader: 3.5,
        practice: 3,
        dmDetail: { lectureAvg: '3.9', lectureN: '5', opsAvg: '3.7', opsN: '3', note: '1Q 베이스라인' },
        leaderDetail: { memberSelf: '3.2', managerScore: '3.6' },
        practiceDetail: {
          cases: [{ id: 'pa0', text: '1Q 파일럿 강의 1건', approved: true, at: '2026-03-20' }],
        },
        memos: [{ id: 'm-a1q', month: 3, type: 'dm', text: '1Q 다면 N=5 충족' }],
      }),
      q2: finalizeQuarterRecord({
        level,
        dm,
        leader,
        practice,
        levelAuto: true,
        dmDetail,
        leaderDetail,
        practiceDetail,
        memos: [
          { id: 'm-a1', month: 4, type: 'level', text: '4월 루브릭 팀장 확정' },
          { id: 'm-a2', month: 6, type: 'practice', text: 'Academizer 실전 2건 인정' },
        ],
      }),
    };
  }

  if (memberCode === 'B') {
    const dmDetail = {
      lectureAvg: '3.6',
      lectureN: '4',
      opsAvg: '3.9',
      opsN: '3',
      note: '겸업 기획·운영 중심 40:60',
      weightMode: DM_WEIGHT_MODE_MANUAL,
      manualLecturePct: String(DM_DUAL_DEFAULT_LECTURE_PCT),
    };
    const leaderDetail = { memberSelf: '2.8', managerScore: '3.2' };
    const practiceDetail = {
      cases: [{ id: 'pb1', text: '겸업: 운영 자동화 스크립트 1건', approved: true, at: '2026-05-08' }],
    };
    const prevDmDetail = { lectureAvg: '3.5', lectureN: '5', opsAvg: '3.6', opsN: '3' };
    const dmOpts = {
      dmProfile: DM_PROFILE.DUAL,
      activityWeights: { lectureWeight: 0.4, opsWeight: 0.6 },
      prevQuarter: { lectureAvg: 3.5, opsAvg: 3.6, teamLevelFallback: 3.2 },
    };
    const dm = computeDmScore(dmDetail, dmOpts).score ?? 3.74;
    return {
      competencyByMonth: [
        { ym: '2026-04', ...buildCompetencyMonth('B', { intLevel: 3, selfMet: 2, mgrMet: 3 }) },
        { ym: '2026-05', ...buildCompetencyMonth('B', { intLevel: 3, selfMet: 3, mgrMet: 3 }) },
        { ym: '2026-06', ...buildCompetencyMonth('B', { intLevel: 3, selfMet: 3, mgrMet: 4 }) },
      ],
      q1: finalizeQuarterRecord({
        level: 3.2,
        dm: 3.5,
        leader: 3.0,
        practice: 3,
        dmDetail: prevDmDetail,
        leaderDetail: { memberSelf: '2.6', managerScore: '3.0' },
        practiceDetail: { cases: [] },
      }),
      q2: finalizeQuarterRecord({
        level: 3.25,
        dm,
        leader: computeLeaderScore(leaderDetail) ?? 3.04,
        practice: computePracticeScore(practiceDetail) ?? 3,
        dmDetail,
        leaderDetail,
        practiceDetail,
        memos: [{ id: 'm-b1', month: 5, type: 'leader', text: '겸업 KPI 달성 근거' }],
      }),
    };
  }

  // C — 기획/운영: 강의 N 미달 → 운영 100%
  const dmDetail = { lectureAvg: '', lectureN: '0', opsAvg: '4.2', opsN: '5', note: '강의 미수행 → 운영 100%' };
  const leaderDetail = { memberSelf: '3.0', managerScore: '3.5' };
  const practiceDetail = {
    cases: [
      { id: 'pc1', text: 'TMS KPI3 화면·샘플 데이터 기획', approved: true, at: '2026-06-01' },
      { id: 'pc2', text: '교육팀 만족도 설문 운영', approved: true, at: '2026-06-03' },
      { id: 'pc3', text: 'cloud-chatbot 연동 기획', approved: true, at: '2026-06-04' },
    ],
  };
  const dm =
    computeDmScore(dmDetail, { dmProfile: DM_PROFILE.PLANNER, prevQuarter: { teamLevelFallback: 3.0 } })
      .score ?? 4.2;
  return {
    competencyByMonth: [
      { ym: '2026-04', ...buildCompetencyMonth('C', { intLevel: 3, selfMet: 3, mgrMet: 3, mgrInt: 3 }) },
      { ym: '2026-05', ...buildCompetencyMonth('C', { intLevel: 3, selfMet: 4, mgrMet: 4, mgrInt: 3 }) },
      { ym: '2026-06', ...buildCompetencyMonth('C', { intLevel: 3, selfMet: 4, mgrMet: 5, mgrInt: 4 }) },
    ],
    q1: finalizeQuarterRecord({
      level: 3.0,
      dm: 4.0,
      leader: 3.2,
      practice: 4,
      dmDetail: { lectureAvg: '', lectureN: '0', opsAvg: '3.8', opsN: '4' },
      practiceDetail: {
        cases: [
          { id: 'pc0a', text: '1Q 운영 만족도 설문', approved: true },
          { id: 'pc0b', text: 'DX 로드맵 정리', approved: true },
        ],
      },
    }),
    q2: finalizeQuarterRecord({
      level: 3.35,
      dm,
      leader: computeLeaderScore(leaderDetail) ?? 3.3,
      practice: computePracticeScore(practiceDetail) ?? 5,
      dmDetail,
      leaderDetail,
      practiceDetail,
      memos: [{ id: 'm-c1', month: 6, type: 'dm', text: '운영 만족도 N=5' }],
    }),
  };
}

/**
 * @returns {{ competencyMonths: Record<string, Record<string, object>>, quarters: Record<string, Record<string, object>> }}
 */
export function buildKpi3AcademizerOperationalSeed() {
  const competencyMonths = {};
  const quarters = { '2026-1Q': {}, '2026-2Q': {} };

  TEAM_KPI_MEMBERS.forEach((m) => {
    const sc = memberScenario(m.code);
    sc.competencyByMonth.forEach(({ ym, ...rec }) => {
      if (!competencyMonths[ym]) competencyMonths[ym] = {};
      competencyMonths[ym][m.code] = rec;
    });
    quarters['2026-1Q'][m.code] = sc.q1;
    quarters['2026-2Q'][m.code] = sc.q2;
  });

  return { competencyMonths, quarters };
}

/** localStorage merge용 partial store */
export function kpi3AcademizerSeedPatch() {
  const { competencyMonths, quarters } = buildKpi3AcademizerOperationalSeed();
  return {
    competencyMonths,
    quarters,
    meta: { updatedAt: new Date().toISOString(), demo: 'kpi3-academizer-2026-2Q' },
  };
}
