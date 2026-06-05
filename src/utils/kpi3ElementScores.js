/** KPI 정의서 §② 다면 · §③ 리더 · §④ 실전 — 산식 (분기 입력용) */

import { DM_PROFILE } from '../constants/kpi3DmProfile';

function round2(n) {
  return Math.round(n * 100) / 100;
}

function num(v) {
  if (v === '' || v == null) return NaN;
  return Number(v);
}

/**
 * @param {{ lectureAvg?: string|number, lectureN?: string|number, opsAvg?: string|number, opsN?: string|number }} dmDetail
 * @param {{
 *   prevQuarter?: { lectureAvg?: number, opsAvg?: number, teamLevelFallback?: number },
 *   dmProfile?: string,
 *   activityWeights?: { lectureWeight?: number, opsWeight?: number },
 * }} [options]
 * @returns {{ score: number|null, note: string }}
 */
export function computeDmScore(dmDetail, options = {}) {
  if (!dmDetail) return { score: null, note: '' };
  const la = num(dmDetail.lectureAvg);
  const ln = parseInt(dmDetail.lectureN, 10) || 0;
  const oa = num(dmDetail.opsAvg);
  const on = parseInt(dmDetail.opsN, 10) || 0;
  const prevLa = options.prevQuarter?.lectureAvg != null ? Number(options.prevQuarter.lectureAvg) : null;
  const prevOa = options.prevQuarter?.opsAvg != null ? Number(options.prevQuarter.opsAvg) : null;
  const teamLevel = options.prevQuarter?.teamLevelFallback;

  let lecturePart = null;
  let lectureNote = '';

  if (ln >= 5 && !Number.isNaN(la)) {
    lecturePart = la;
    lectureNote = '강의 N≥5 당분기 평균';
  } else if (ln >= 3 && ln < 5 && !Number.isNaN(la)) {
    if (prevLa != null && !Number.isNaN(prevLa)) {
      lecturePart = round2(la * 0.6 + prevLa * 0.4);
      lectureNote = '강의 3≤N<5 → 당분기×0.6 + 전분기×0.4';
    } else {
      lecturePart = la;
      lectureNote = '강의 3≤N<5 (전분기 없음 → 당분기만)';
    }
  } else if (ln > 0 && ln < 3) {
    lectureNote = '강의 N<3 → 강의 축 제외';
  }

  let opsPart = null;
  let opsNote = '';

  if (on >= 3 && !Number.isNaN(oa)) {
    opsPart = oa;
    opsNote = '운영 N≥3 당분기 평균';
  } else if (on > 0 && on < 3) {
    if (prevOa != null && !Number.isNaN(prevOa)) {
      opsPart = prevOa;
      opsNote = '운영 N<3 → 전분기 운영 대체';
    } else if (teamLevel != null && !Number.isNaN(teamLevel) && teamLevel > 0) {
      opsPart = teamLevel;
      opsNote = '운영 N<3 · 전분기 없음 → 분기 레벨 대체';
    }
  }

  const profile = options.dmProfile || DM_PROFILE.LEGACY;
  const lw =
    options.activityWeights?.lectureWeight != null
      ? Number(options.activityWeights.lectureWeight)
      : 0.7;
  const ow =
    options.activityWeights?.opsWeight != null
      ? Number(options.activityWeights.opsWeight)
      : round2(1 - lw);

  let score = null;
  let note = '';

  if (profile === DM_PROFILE.INSTRUCTOR) {
    if (lecturePart != null) {
      score = round2(lecturePart);
      note = `${lectureNote} (강사·강의 100%)`;
    } else if (lectureNote) {
      note = `${lectureNote} (강사·강의 축 없음)`;
    }
    return { score, note };
  }

  if (lecturePart != null && opsPart != null) {
    if (profile === DM_PROFILE.DUAL) {
      score = round2(lecturePart * lw + opsPart * ow);
      const pctL = Math.round(lw * 100);
      const pctO = Math.round(ow * 100);
      note = `${lectureNote} + ${opsNote} (겸업 M/M ${pctL}:${pctO})`;
    } else {
      score = round2(lecturePart * 0.7 + opsPart * 0.3);
      note = `${lectureNote} + ${opsNote} (70:30)`;
    }
  } else if (lecturePart == null && opsPart != null) {
    score = round2(opsPart);
    note = lectureNote ? `${lectureNote}; ${opsNote} (운영 100%)` : `${opsNote} (운영 100%)`;
  } else if (lecturePart != null && opsPart == null) {
    score = round2(lecturePart);
    note = `${lectureNote} (강의 100%)`;
  }

  return { score, note };
}

/** @deprecated 호환 — 점수만 */
export function computeDmScoreValue(dmDetail, options) {
  return computeDmScore(dmDetail, options).score;
}

/**
 * 리더 평가 = 자체(40%) + 팀장(60%)
 */
export function computeLeaderScore(leaderDetail) {
  if (!leaderDetail) return null;
  const self = num(leaderDetail.memberSelf);
  const mgr = num(leaderDetail.managerScore);
  if (!Number.isNaN(self) && !Number.isNaN(mgr)) return round2(self * 0.4 + mgr * 0.6);
  if (!Number.isNaN(mgr)) return round2(mgr);
  if (!Number.isNaN(self)) return round2(self);
  return null;
}

/** KPI1·KPI2 등급 → 리더 평가 참고 점수 (둘 중 낮은 축) */
const GRADE_TO_LEADER = { S: 5, A: 4, B: 3, C: 2, D: 1 };

export function leaderScoreFromKpiGrades(gradeKpi1, gradeKpi2) {
  const a = GRADE_TO_LEADER[gradeKpi1];
  const b = GRADE_TO_LEADER[gradeKpi2];
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

/**
 * 실전 적용 5점 척도 (팀장 인정 건수)
 */
export function computePracticeScore(practiceDetail) {
  const cases = practiceDetail?.cases || [];
  const approved = cases.filter((c) => c.approved).length;
  if (approved >= 3) return 5;
  if (approved === 2) return 4;
  if (approved === 1) return 3;
  if (cases.length > 0) return 2;
  return null;
}
