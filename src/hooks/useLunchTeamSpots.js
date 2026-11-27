import { useCallback, useEffect, useState } from 'react';
import { normalizeLunchTags } from './useLunchCustomSpots';

export const LUNCH_SPOTS_API = '/api/lunch-spots';
export const LUNCH_TEAM_VISITS_API = '/api/lunch-visits?scope=team&days=30';

async function callApi(method, { query = '', body } = {}) {
  let res;
  try {
    res = await fetch(`${LUNCH_SPOTS_API}${query}`, {
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
    return { ok: false, httpStatus: res.status, message: data?.message || `HTTP ${res.status}`, data };
  }
  return { ok: true, data };
}

const toSpot = (s) => ({ ...s, tags: normalizeLunchTags(Array.isArray(s.tags) ? s.tags : []), source: 'team' });

/** 화면 입력에서 서버로 보낼 값(id·source 등 화면 전용 값은 뺀다) */
function toPayload(input) {
  const { id: _id, source: _source, addedAt: _addedAt, createdBy: _by, createdAt: _at, updatedAt: _up, ...rest } = input;
  return rest;
}

/**
 * 팀이 함께 쓰는 식당 목록(Supabase lunch_spots). 서버를 못 쓰면 status='unavailable' —
 * 화면은 지금처럼 브라우저 등록 목록으로 대신한다.
 */
export function useLunchTeamSpots() {
  const [spots, setSpots] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | unavailable
  const [actor, setActor] = useState(null); // 'A' | 'B' | 'C' | 'admin'

  useEffect(() => {
    let alive = true;
    callApi('GET').then((r) => {
      if (!alive) return;
      if (r.ok) {
        setSpots((r.data.spots || []).map(toSpot));
        setActor(r.data.actor || null);
        setStatus('ready');
      } else {
        setStatus('unavailable');
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  /** @returns {Promise<{ ok: true, spot: object } | { ok: false, message: string, duplicateId?: string }>} */
  const addSpot = useCallback(async (input) => {
    const r = await callApi('POST', { body: toPayload(input) });
    if (!r.ok) return { ok: false, message: r.message, duplicateId: r.data?.id };
    const spot = toSpot(r.data.spot);
    setSpots((prev) => [...prev, spot]);
    return { ok: true, spot };
  }, []);

  const updateSpot = useCallback(async (id, input) => {
    const r = await callApi('PATCH', { query: `?id=${encodeURIComponent(id)}`, body: toPayload(input) });
    if (!r.ok) return { ok: false, message: r.message };
    const spot = toSpot(r.data.spot);
    setSpots((prev) => prev.map((s) => (s.id === id ? spot : s)));
    return { ok: true, spot };
  }, []);

  const removeSpot = useCallback(async (id) => {
    const r = await callApi('DELETE', { query: `?id=${encodeURIComponent(id)}` });
    if (!r.ok) return { ok: false, message: r.message };
    setSpots((prev) => prev.filter((s) => s.id !== id));
    return { ok: true };
  }, []);

  /** 등록한 구성원이나 관리자만 고칠 수 있다(서버도 같은 규칙으로 막는다). */
  const canManage = useCallback(
    (spot) => spot?.source === 'team' && Boolean(actor) && (actor === 'admin' || spot.createdBy === actor),
    [actor]
  );

  return { spots, status, actor, addSpot, updateSpot, removeSpot, canManage };
}

/** 팀 전체 최근 30일 점심 기록(서로의 단골 보기용). 못 불러오면 빈 목록. */
export function useLunchTeamVisits(refreshKey) {
  const [visits, setVisits] = useState([]);
  useEffect(() => {
    let alive = true;
    fetch(LUNCH_TEAM_VISITS_API, { credentials: 'same-origin' })
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (alive && res.ok && data?.ok === true) setVisits(Array.isArray(data.visits) ? data.visits : []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [refreshKey]);
  return visits;
}
