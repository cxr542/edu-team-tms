/** 사용자 → 관리자 KPI 승인 요청 (P0: KPI1 월 확정, KPI2 효과 건) */

export const KPI_APPROVAL_REQUEST = {
  sectionTitle: 'KPI 승인 요청',
  sectionHint:
    '일지 작성이 끝난 뒤 필요할 때만 승인을 요청하세요. 처리 결과는 관리자 「KPI 승인」 메뉴에서 일괄 확인됩니다.',
  requestKpi1: '승인 요청',
  requestKpi1Hint: '이번 달 주간 M/M 합계를 반영한 뒤 관리자에게 월 확정 승인을 요청합니다.',
  requestKpi2: '승인 요청',
  requestKpi2Hint: '이 효과 건에 대한 관리자 승인을 요청합니다.',
  withdrawKpi1: '요청 취소',
  withdrawKpi1Hint: '승인 대기 중인 월 확정 요청을 취소하고 다시 수정합니다.',
  statusPending: '승인 대기',
  statusApproved: '승인됨',
  statusRejected: '반려됨',
  statusDraft: '작성 중',
};
