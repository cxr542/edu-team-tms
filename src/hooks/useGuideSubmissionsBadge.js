import { useCallback, useEffect, useState } from 'react';
import { listGuideSubmissions } from '../utils/referenceDocsHidden.js';

const REFRESH_MS = 30000;
const EMPTY = { count: 0, items: [] };

/** 관리자 종 알림용: 구성원이 제출한 강의 가이드(승인 대기) 목록. 읽기 전용 조회. */
export function useGuideSubmissionsBadge(enabled) {
  const [state, setState] = useState(EMPTY);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState(EMPTY);
      return;
    }
    const res = await listGuideSubmissions();
    if (!res.ok) {
      setState(EMPTY);
      return;
    }
    setState({ count: res.items.length, items: res.items });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setState(EMPTY);
      return undefined;
    }
    void refresh();
    window.addEventListener('focus', refresh);
    // 승인·거절 직후 종 알림도 바로 갱신되도록 화면에서 보내는 이벤트
    window.addEventListener('guide-submissions-changed', refresh);
    const id = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('guide-submissions-changed', refresh);
      window.clearInterval(id);
    };
  }, [enabled, refresh]);

  return state;
}
