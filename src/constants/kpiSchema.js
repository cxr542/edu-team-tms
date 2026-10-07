import { JOURNAL_LINKED_MEMBER_CODE, findKpiMember, TEAM_KPI_MEMBERS } from './kpiMembers.js';

/** @deprecated use findKpiMember / TEAM_KPI_MEMBERS */
export const KPI_JOURNAL_MEMBER = findKpiMember(JOURNAL_LINKED_MEMBER_CODE) || TEAM_KPI_MEMBERS[0];

export { TEAM_KPI_MEMBERS, JOURNAL_LINKED_MEMBER_CODE, findKpiMember };

export const KPI_SHEET_01 = '01_KPI1_입력';
export const KPI_SHEET_03 = '03_KPI3';

export const KPI_SHEET_01C = '01c_KPI1_주간메모';
export const KPI_SHEET_02 = '02_KPI2_입력';

/**
 * 엑셀·복사(TSV)·화면 표에 보이는 헤더 라벨 (정의서 v6: M/M → M/D).
 * 행 객체의 키(업무MM 등)와 KPI_*_HEADERS 값은 호환을 위해 그대로 두고, 표시만 바꾼다.
 */
export const KPI_HEADER_LABELS = {
  업무MM: '업무MD',
  생산향상MM: '생산향상MD',
  휴일MM: '휴일MD',
  가용MM: '가용MD',
};

export function kpiHeaderLabel(header) {
  return KPI_HEADER_LABELS[header] ?? header;
}

export const KPI_01C_HEADERS = [
  '연도',
  '주시작일',
  '구성원',
  '업무MM',
  '생산향상MM',
  '휴일MM',
  '주간메모',
  '해당월',
  '분기',
];

export const KPI_01_HEADERS = [
  '연도',
  '월',
  '분기',
  '구성원',
  '업무MM',
  '생산향상MM',
  '휴일MM',
  '가용MM',
  '가동률%',
  '상태',
  '제출일',
  '승인일',
  '승인자',
];

export const KPI_02_HEADERS = [
  '완료일',
  '연도',
  '월',
  '분기',
  '구성원',
  '업무명',
  '계획시간',
  '실작업시간',
  '생산성%',
  '계획승인',
  '상태',
  '코멘트',
  '승인자',
  '승인일',
];
