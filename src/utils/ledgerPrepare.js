import { normalizeTransaction } from '../constants/usageCategories';
import { calculateBalances } from './ledgerBalances';

/** 거래 목록을 카테고리 기준으로 정규화하고 날짜순 정렬·월별 잔액을 계산한다. (편집·조회 화면 공용) */
export function prepareLedger(rawList, categories) {
  const normalized = rawList.map((tx) => normalizeTransaction(tx, categories));
  return calculateBalances(normalized);
}
