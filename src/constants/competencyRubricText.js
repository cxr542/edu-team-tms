import { accumulationOrderForRole } from './competencyRubric.js';

/** 5차원 평가 기준 (정수레벨 1~5 관찰 문구) — 교육팀_KPI_정의서 · 설계노트 §4 */

/** 본부 5단계 정수레벨 정의 */
export const INTEGER_LEVELS = [
  {
    level: 1,
    shortLabel: '기초',
    title: 'Level 1 – 기초',
    description:
      '신규 입사자 또는 신입 만 1년 미만 수준. 매뉴얼·가이드 없이는 수행 어렵고, 항상 밀착된 지시·검토가 필요.',
  },
  {
    level: 2,
    shortLabel: '기본',
    title: 'Level 2 – 기본',
    description:
      '정해진 절차나 템플릿을 따라 기본 업무 수행 가능. 단순·반복 업무는 할 수 있으나, 예외 상황 도움 필요.',
  },
  {
    level: 3,
    shortLabel: '독립 수행',
    title: 'Level 3 – 독립 수행',
    description:
      '일반적인 상황에서는 스스로 계획·수행·산출까지 가능. 복잡하거나 전략적인 이슈는 상위자 코칭·리뷰 필요.',
  },
  {
    level: 4,
    shortLabel: '숙련',
    title: 'Level 4 – 숙련',
    description:
      '대부분의 상황에서 높은 품질로 독립 수행, 복잡한 케이스도 안정적으로 처리. 문제를 미리 예측하고, 업무 방식을 개선하거나 남을 코칭하기 시작.',
  },
  {
    level: 5,
    shortLabel: '전문가',
    title: 'Level 5 – 전문가',
    description:
      '영역 내에서 레퍼런스 역할, 기준·프레임워크를 설계하는 수준. 크리티컬한 과제·딜을 주도하고, 다른 구성원을 체계적으로 멘토링.',
  },
];

const DEFAULT_RUBRIC_ROWS = [
  {
    id: 'autonomy',
    label: '자율성',
    levels: [
      '매뉴얼 없이 동일 유형도 어렵다. 일정·우선순위 대부분 배정.',
      '정형 절차 내에서는 끝까지 수행. 예외 시 질문·에스컬레이션 다수.',
      '일반 케이스는 계획~산출 스스로. 복잡 이슈는 상위와 짝.',
      '복잡 케이스도 안정적으로 끝냄. 리스크 사전 공유.',
      '영역 표준을 세우고 주도. 크리티컬 과제 리드.',
    ],
  },
  {
    id: 'scope',
    label: '범위·난이도',
    levels: [
      '단순·보조 업무 위주.',
      '단순·반복 중심. 난이도 상승 시 지원 필요.',
      '일반 난이도 담당. 전략 과제는 분리.',
      '고난이도·예외 비중 높아도 처리.',
      '가장 어려운 딜·과제 배정의 중심.',
    ],
  },
  {
    id: 'collaboration',
    label: '협업·영향',
    levels: [
      '협업은 지시 단위로 진행.',
      '협업 가능하나 조율은 리드가 많이 함.',
      '이해관계자와 일상 조율 가능.',
      '타 직무/고객과 선제 조율·코칭 시작.',
      '조직 단위 멘토링·정렬. 프레임으로 영향 확대.',
    ],
  },
  {
    id: 'quality',
    label: '품질·완결성',
    levels: [
      '산출물 매번 상세 리뷰·수정 필요.',
      '통과 수준. 재작업은 가끔 발생.',
      '리뷰는 방향·리스크 중심. 문장 단위 수정 감소.',
      '재작업·클레임 적음. 품질 일관.',
      '품질이 레퍼런스. 검수 기준·체크리스트 기여.',
    ],
  },
  {
    id: 'expertise',
    label: '전문성·표준화',
    levels: [
      '표준 문서 숙지 단계.',
      '템플릿·가이드 준수.',
      '가이드 개선 제안 가끔.',
      '프로세스 개선·내부 가이드 초안.',
      '기준·프레임워크 설계. 레퍼런스 역할.',
    ],
  },
];

/** SoT: 교육팀_KPI_정의서 — 강사·기획/운영 역량 수준 기준표 (겸업은 두 표 병합) */
const ROLE_RUBRIC_OVERRIDES = {
  instructor: {
    autonomy: [
      '매뉴얼 없이 동일 유형도 어렵다',
      '정형 절차 내에서는 끝까지 수행',
      '일반 케이스는 계획~산출 스스로',
      '복잡 케이스도 안정적으로 완수',
      '강의 표준을 세우고 주도',
    ],
    scope: [
      '단순 보조 강의 위주',
      '단순·반복 강의 중심',
      '일반 난이도 과정 담당',
      '고난이도·신규 과정도 처리',
      '가장 어려운 과정 설계의 중심',
    ],
    collaboration: [
      '지시 단위로 진행',
      '조율은 팀장이 많이 함',
      '수강생·유관부서 일상 조율',
      '선제 조율·수강생 코칭 시작',
      '조직 멘토링·교육 체계 영향',
    ],
    quality: [
      '교안 매번 상세 수정 필요',
      '통과 수준. 재작업 가끔',
      '리뷰는 방향 중심. 수정 감소',
      '재작업 적음. 강의 품질 일관',
      '품질 레퍼런스. 검수 기준 기여',
    ],
    expertise: [
      '표준 교안 숙지 단계',
      '템플릿·가이드 준수',
      '가이드 개선 제안 가끔',
      '강의 프로세스 개선·교안 초안',
      '강의 기준·프레임워크 설계',
    ],
  },
  planner: {
    autonomy: [
      '매뉴얼 없이 동일 유형도 어렵다',
      '정형 절차 내에서는 끝까지 수행',
      '일반 케이스는 계획~산출 스스로',
      '복잡 케이스도 안정적으로 완수',
      '운영 표준을 세우고 주도',
    ],
    scope: [
      '단순 보조 운영 위주',
      '단순·반복 운영 중심',
      '일반 난이도 과정 운영 담당',
      '고난이도·신규 과정도 처리',
      '가장 어려운 과정 기획의 중심',
    ],
    collaboration: [
      '지시 단위로 진행',
      '조율은 팀장이 많이 함',
      '강사·수강생 일상 조율 가능',
      '유관부서·고객과 선제 조율',
      '조직 멘토링·운영 체계 영향',
    ],
    quality: [
      '운영 산출물 매번 수정 필요',
      '통과 수준. 재작업 가끔',
      '리뷰는 방향 중심. 수정 감소',
      '재작업 적음. 운영 품질 일관',
      '품질 레퍼런스. 운영 기준 기여',
    ],
    expertise: [
      '표준 운영 매뉴얼 숙지 단계',
      '템플릿·가이드 준수',
      '운영 가이드 개선 제안 가끔',
      '운영 프로세스 개선·가이드 초안',
      '운영 기준·프레임워크 설계',
    ],
  },
  concurrent: {
    autonomy: [
      '매뉴얼 없이 동일 유형도 어렵다.',
      '정형 절차 내에서는 끝까지 수행.',
      '일반 케이스는 계획~산출 스스로.',
      '복잡 케이스도 안정적으로 완수.',
      '강의·운영 표준을 세우고 주도.',
    ],
    scope: [
      '단순 보조 강의·운영 위주.',
      '단순·반복 강의·운영 중심.',
      '일반 난이도 과정 담당·운영.',
      '고난이도·신규 과정도 처리.',
      '가장 어려운 과정 설계·기획의 중심.',
    ],
    collaboration: [
      '지시 단위로 진행.',
      '조율은 팀장이 많이 함.',
      '수강생·유관부서 일상 조율.',
      '선제 조율·강사·수강생 코칭 시작.',
      '조직 멘토링·교육·운영 체계 영향.',
    ],
    quality: [
      '교안·운영 산출물 매번 수정 필요.',
      '통과 수준. 재작업 가끔.',
      '리뷰는 방향 중심. 수정 감소.',
      '재작업 적음. 강의·운영 품질 일관.',
      '품질 레퍼런스. 검수·운영 기준 기여.',
    ],
    expertise: [
      '표준 교안·운영 매뉴얼 숙지 단계.',
      '템플릿·가이드 준수.',
      '가이드·운영 개선 제안 가끔.',
      '강의·운영 프로세스 개선·가이드 초안.',
      '강의·운영 기준·프레임워크 설계',
    ],
  },
};

function buildRoleRubricRows(overrides = {}) {
  return DEFAULT_RUBRIC_ROWS.map((row) => ({
    ...row,
    levels: overrides[row.id] || row.levels,
  }));
}

export const ROLE_RUBRIC_ROWS = {
  default: DEFAULT_RUBRIC_ROWS,
  instructor: buildRoleRubricRows(ROLE_RUBRIC_OVERRIDES.instructor),
  planner: buildRoleRubricRows(ROLE_RUBRIC_OVERRIDES.planner),
  concurrent: buildRoleRubricRows(ROLE_RUBRIC_OVERRIDES.concurrent),
};

/** @deprecated default 직군 — ROLE_RUBRIC_ROWS.default 와 동일 */
export const RUBRIC_ROWS = ROLE_RUBRIC_ROWS.default;

export function rubricRowsForRole(roleId) {
  return ROLE_RUBRIC_ROWS[roleId] || ROLE_RUBRIC_ROWS.default;
}

/** 설계노트 §4 — 행 순서 = 직군별 소수 누적 순서 */
export function rubricRowsOrderedForRole(roleId) {
  const rows = rubricRowsForRole(roleId);
  const order = accumulationOrderForRole(roleId);
  return order.map((id) => rows.find((row) => row.id === id)).filter(Boolean);
}

export function rubricObserveText(roleId, dimId, intLevel) {
  const level = Number(intLevel);
  if (!Number.isInteger(level) || level < 1 || level > 5) return '';
  const row = rubricRowsForRole(roleId).find((r) => r.id === dimId);
  return row?.levels[level - 1] || '';
}

export const ROLE_RUBRIC_HINTS = {
  default: '공통 5차원 — 직군 미지정 시 일반 관찰 문구',
  instructor: '신기술(K8s/Ceph 등) 자산화 · 강의 만족도 · 교안 정밀도·표준화',
  planner: '이해관계자 조율 · 운영 프로세스 자동화 · DX 기획·로드맵',
  concurrent: '강의·운영 겸업 — KPI 정의서 강사·기획/운영 표 병합',
};

export const ROLE_ACCUMULATION_HINTS = {
  default: '자율성 → 범위·난이도 → 협업·영향 → 품질·완결성 → 전문성·표준화',
  instructor: '전문성·표준화 → 품질·완결성 → 협업·영향 → 범위·난이도 → 자율성',
  planner: '협업·영향 → 자율성 → 범위·난이도 → 품질·완결성 → 전문성·표준화',
  concurrent: '협업·영향 → 범위·난이도 → 품질·완결성 → 전문성·표준화 → 자율성',
};

export function integerLevelOptionLabel(level) {
  const row = INTEGER_LEVELS.find((r) => r.level === level);
  return row ? `${level} · ${row.shortLabel}` : String(level);
}
