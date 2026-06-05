import { KPI3_WEIGHTS } from './kpiRules';
import {
  DM_DUAL_DEFAULT_LECTURE_PCT,
  DM_PROFILE,
  DM_WEIGHT_MODE_MANUAL,
  resolveDmProfile,
} from './kpi3DmProfile';

/** KPI 정의서 §지표3 · 4가지 측정 요소 */
export const KPI3_ELEMENTS = [
  {
    key: 'level',
    label: '레벨',
    fullLabel: '레벨 (본부 기준표·5차원)',
    weightPct: Math.round(KPI3_WEIGHTS.level * 100),
    summary: '월간 역량 평가(자체·팀장) 분기 평균 → 팀 레벨(35%)',
    docSection: '세부 지표 ①',
  },
  {
    key: 'dm',
    label: '다면 평가',
    fullLabel: '다면 평가 점수',
    weightPct: Math.round(KPI3_WEIGHTS.dm * 100),
    summary: '직군별: 강사=강의 100%, 겸업=40:60 기본·30~70% 조정, 기획/운영=운영 중심',
    docSection: '세부 지표 ②',
  },
  {
    key: 'leader',
    label: '리더 평가',
    fullLabel: '리더 평가',
    weightPct: Math.round(KPI3_WEIGHTS.leader * 100),
    summary: '팀원 자체평가(40%) + 팀장 평가(60%), KPI1·2 등급 참고',
    docSection: '세부 지표 ③',
  },
  {
    key: 'practice',
    label: '역량 실전 적용률',
    fullLabel: '역량 실전 적용률',
    weightPct: Math.round(KPI3_WEIGHTS.practice * 100),
    summary: '분기 실전 사례 증빙·팀장 인정 건수 → 5점 척도',
    docSection: '세부 지표 ④',
  },
];

export const KPI3_FORMULA_TEXT =
  '교육팀 핵심 역량 레벨 = (레벨×35%) + (다면×15%) + (리더×25%) + (실전×25%)';

export function defaultDmDetail() {
  return {
    lectureAvg: '',
    lectureN: '',
    opsAvg: '',
    opsN: '',
    note: '',
    weightMode: 'journal',
    manualLecturePct: '',
  };
}

/** 겸업: 분기 최초 생성 시 기획·운영 중심(40:60) 수동 가중 */
export function defaultDmDetailForRole(memberRole) {
  const base = defaultDmDetail();
  if (resolveDmProfile(memberRole) === DM_PROFILE.DUAL) {
    return {
      ...base,
      weightMode: DM_WEIGHT_MODE_MANUAL,
      manualLecturePct: String(DM_DUAL_DEFAULT_LECTURE_PCT),
    };
  }
  return base;
}

export function defaultLeaderDetail() {
  return { memberSelf: '', managerScore: '', note: '' };
}

export function defaultPracticeDetail() {
  return { cases: [] };
}
