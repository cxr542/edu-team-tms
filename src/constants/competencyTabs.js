/** 역량 평가 — 구성원별 4개 평가 탭 */

export const COMPETENCY_MEMBER_TABS = [
  {
    id: 'level',
    label: '레벨·자체평가',
    hint: '선택한 분기의 정수 레벨·5차원을 작성하고 자체평가를 확정하세요. KPI3 분기 레벨(35%)은 팀장이 월별 역량 확정 후 반영됩니다.',
  },
  {
    id: 'dm',
    label: '다면평가',
    hint: '분기 다면 평가를 입력한 뒤 「분기 점수에 반영」하세요.',
  },
  {
    id: 'leader',
    label: '리더평가',
    hint: '분기 리더십 평가를 입력하세요. 팀장 평가·확정은 팀 KPI 관리에서 처리합니다.',
  },
  {
    id: 'practice',
    label: '실전 적용',
    hint: '분기 실전 적용(증빙·건수)을 입력하세요.',
  },
];

export const COMPETENCY_PAGE_HINT =
  '구성원을 선택하면 전용 페이지에서 분기 기준 레벨·자체평가와 다면·리더·실전 평가를 탭으로 작성합니다.';

/** @deprecated use COMPETENCY_MEMBER_TABS */
export const COMPETENCY_MONTHLY_HINT = COMPETENCY_MEMBER_TABS[0].hint;

/** @deprecated use COMPETENCY_MEMBER_TABS */
export const COMPETENCY_QUARTERLY_HINT = COMPETENCY_MEMBER_TABS[1].hint;

export const COMPETENCY_ELEMENT_LABELS = {
  dm: '다면 평가',
  leader: '리더십 평가',
  practice: '실전 적용',
};
