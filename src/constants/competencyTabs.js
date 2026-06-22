/** 역량 평가 — 구성원별 4개 평가 탭 */

export const COMPETENCY_MEMBER_TABS = [
  {
    id: 'level',
    label: '레벨 자체평가',
    hint: '이번 달 나의 역량 수준을 스스로 체크합니다. 숫자 레벨과 5차원 충족 여부를 입력하고, 근거에는 업무일지 날짜·산출물 링크·개선 사례를 남겨주세요.',
  },
  {
    id: 'dm',
    label: '다면평가',
    hint: '이번 분기의 협업·동료 피드백 내용을 입력합니다.',
  },
  {
    id: 'leader',
    label: '리더평가',
    hint: '이번 분기의 주도성·일정 조율·리딩 사례를 입력합니다.',
  },
  {
    id: 'practice',
    label: '실전 적용',
    hint: '이번 분기의 실무 적용 사례와 증빙을 입력합니다.',
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
