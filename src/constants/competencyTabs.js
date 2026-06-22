/** 역량 평가 — 구성원별 4개 평가 탭 */

export const COMPETENCY_MEMBER_TABS = [
  {
    id: 'level',
    label: '레벨 자체평가',
    hint: '레벨 자체평가는 월별로 작성합니다. 레벨은 정수 레벨과 5차원 충족 여부를 함께 의미하며, 자체평가 근거에는 업무일지 날짜·산출물·링크 등을 남겨주세요.',
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
  '구성원을 선택하면 전용 페이지에서 월별 레벨 자체평가와 분기별 다면·리더·실전 평가를 작성합니다.';

/** @deprecated use COMPETENCY_MEMBER_TABS */
export const COMPETENCY_MONTHLY_HINT = COMPETENCY_MEMBER_TABS[0].hint;

/** @deprecated use COMPETENCY_MEMBER_TABS */
export const COMPETENCY_QUARTERLY_HINT = COMPETENCY_MEMBER_TABS[1].hint;

export const COMPETENCY_ELEMENT_LABELS = {
  dm: '다면 평가',
  leader: '리더십 평가',
  practice: '실전 적용',
};
