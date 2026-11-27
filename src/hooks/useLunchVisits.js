import { useCallback, useEffect, useState } from 'react';
import { kstTodayKey } from '../utils/lunchVisits';

export const LUNCH_VISITS_API = '/api/lunch-visits';

async function callApi(method, body, query = '') {
  let res;
  try {
    res = await fetch(method === 'GET' ? `${LUNCH_VISITS_API}?days=120` : `${LUNCH_VISITS_API}${query}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch (error) {
    return { ok: false, message: error?.message || '네트워크 오류' };
  }
  const data = await res.json().catch(() => ({}));
  // 개발 서버처럼 API 가 없으면 HTML 이 200 으로 올 수 있어 ok:true 를 꼭 확인한다.
  if (!res.ok || data?.ok !== true) {
    return { ok: false, httpStatus: res.status, message: data?.message || `HTTP ${res.status}` };
  }
  return { ok: true, data };
}

/**
 * 서버(Supabase lunch_visits)에 저장되는 구성원별 점심 기록.
 * 서버를 못 쓰면 available=false — 화면은 브라우저 기록으로 대신 보여준다.
 */
export function useLunchVisits() {
  const [visits, setVisits] = useState([]);
  const [today, setToday] = useState(() => kstTodayKey());
  const [status, setStatus] = useState('loading'); // loading | ready | unavailable
  const [message, setMessage] = useState('');

  useEffect(() => {
    let alive = true;
    callApi('GET').then((r) => {
      if (!alive) return;
      if (r.ok) {
        setVisits(Array.isArray(r.data.visits) ? r.data.visits : []);
        if (r.data.today) setToday(r.data.today);
        setStatus('ready');
      } else {
        setStatus('unavailable');
        setMessage(r.message || '');
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  /** 점심을 기록(기본 오늘, day 로 지난 6일 안의 날짜). 같은 날이면 바꾼다. 실패하면 { ok:false, message } */
  const recordToday = useCallback(
    async (spot, day) => {
      if (status !== 'ready') return { ok: false, message: '서버 기록을 쓸 수 없습니다.' };
      const r = await callApi('POST', {
        spotId: spot.id,
        spotName: spot.name,
        category: spot.category || '',
        ...(day ? { day } : {}),
      });
      if (!r.ok) return r;
      const visit = r.data.visit;
      setVisits((prev) => [visit, ...prev.filter((v) => v.day !== visit.day)]);
      return { ok: true, visit };
    },
    [status]
  );

  /** 기록 지우기(기본 오늘) */
  const clearToday = useCallback(async (day) => {
    if (status !== 'ready') return { ok: false, message: '서버 기록을 쓸 수 없습니다.' };
    const r = await callApi('DELETE', undefined, day ? `?day=${encodeURIComponent(day)}` : '');
    if (!r.ok) return r;
    setVisits((prev) => prev.filter((v) => v.day !== r.data.day));
    return { ok: true };
  }, [status]);

  return { visits, today, status, message, recordToday, clearToday };
}
