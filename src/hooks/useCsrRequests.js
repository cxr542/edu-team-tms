import { useCallback, useEffect, useMemo, useState } from 'react';
import { findKpiMember } from '../constants/kpiMembers.js';
import {
  buildCsrRequestDraft,
  normalizeCsrRequest,
} from '../utils/csrRequestsSupabase.js';
import {
  listCsrRequestsFromSupabase,
  upsertCsrRequestToSupabase,
  updateCsrRequestStatusInSupabase,
} from '../utils/csrRequestsSupabase.js';

function memberLabel(memberCode) {
  const member = findKpiMember(memberCode);
  return member?.displayName || memberCode || '알 수 없음';
}

function sortRequests(requests) {
  return [...requests].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
    if (aTime !== bTime) return bTime - aTime;
    return String(a.id).localeCompare(String(b.id));
  });
}

function mergeById(prev, next) {
  const map = new Map(prev.map((item) => [item.id, item]));
  next.forEach((item) => map.set(item.id, item));
  return sortRequests([...map.values()]);
}

function buildFallbackCountSummary(requests) {
  return requests.reduce(
    (acc, request) => {
      const status = request.status || 'received';
      acc.total += 1;
      if (status === 'received') acc.received += 1;
      if (status === 'inProgress') acc.inProgress += 1;
      if (status === 'done') acc.done += 1;
      if (status === 'hold') acc.hold += 1;
      if (status === 'rejected') acc.rejected += 1;
      return acc;
    },
    { total: 0, received: 0, inProgress: 0, done: 0, hold: 0, rejected: 0 }
  );
}

/** Local-only cards so CSR UI can be reviewed without `.env` Supabase keys. */
const DEV_CSR_PREVIEW_REQUESTS = [
  {
    id: 'dev-preview-csr-done',
    title: '테스트 요청사항',
    description: '로컬 UI 미리보기용 샘플입니다. `.env`에 Supabase 키를 넣으면 실제 목록이 표시됩니다.',
    category: 'improvement',
    status: 'done',
    requester: '김윤형',
    requesterCode: 'A',
    adminComment: '',
    createdAt: '2026-07-16T00:40:00.000Z',
    updatedAt: '2026-07-16T00:54:00.000Z',
    completedAt: '2026-07-16T00:54:00.000Z',
    categoryLabel: '개선요청',
  },
  {
    id: 'dev-preview-csr-received',
    title: '접수 상태 샘플',
    description: '상태·상태 변경·저장 버튼 레이아웃 확인용.',
    category: 'bug',
    status: 'received',
    requester: '최우성',
    requesterCode: 'B',
    adminComment: '',
    createdAt: '2026-07-16T01:00:00.000Z',
    updatedAt: '2026-07-16T01:00:00.000Z',
    completedAt: null,
    categoryLabel: '버그',
  },
];

export function useCsrRequests({ requesterCode, requesterName = null, canManage = false } = {}) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);
  const [sourceStatus, setSourceStatus] = useState('loading');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listCsrRequestsFromSupabase({
      requesterCode: canManage ? undefined : requesterCode,
    });

    if (!result.ok && result.status !== 'empty') {
      if (result.status === 'disabled' && import.meta.env.DEV) {
        setRequests(DEV_CSR_PREVIEW_REQUESTS);
        setSourceStatus('disabled');
        setError(
          'Supabase가 설정되지 않아 로컬 UI 미리보기를 표시합니다. 실제 데이터는 `.env`에 VITE_SUPABASE_URL·VITE_SUPABASE_ANON_KEY를 넣은 뒤 Vite를 재시작하세요.'
        );
        setLoading(false);
        return result;
      }
      setRequests([]);
      setSourceStatus(result.status);
      setError(result.message);
      setLoading(false);
      return result;
    }

    const next = Array.isArray(result.data) ? result.data.map(normalizeCsrRequest).filter(Boolean) : [];
    setRequests(sortRequests(next));
    setSourceStatus(result.status);
    setLoading(false);
    return result;
  }, [canManage, requesterCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createRequest = useCallback(
    async (draft) => {
      const built = buildCsrRequestDraft({
        ...draft,
        requester: draft?.requester || requesterName || memberLabel(requesterCode),
        requesterCode,
      });

      if (!built.ok) {
        return built;
      }

      setSavingId(built.data.id);
      const result = await upsertCsrRequestToSupabase(built.data);
      if (result.ok && result.data) {
        setRequests((prev) => mergeById(prev, [result.data]));
      } else if (!result.ok && result.status !== 'disabled') {
        setError(result.message);
      }
      setSavingId(null);
      return result;
    },
    [requesterCode, requesterName]
  );

  const updateRequest = useCallback(
    async (requestId, patch) => {
      const current = requests.find((item) => item.id === requestId);
      if (!current) {
        return { ok: false, status: 'error', message: 'request not found.' };
      }

      const nextRequest = {
        ...current,
        ...patch,
        id: current.id,
        requester: current.requester,
        requesterCode: current.requesterCode,
      };

      setSavingId(requestId);
      const result = await updateCsrRequestStatusInSupabase({
        request: nextRequest,
        id: requestId,
        status: patch?.status ?? current.status,
        adminComment: patch?.adminComment ?? current.adminComment,
      });
      if (result.ok && result.data) {
        setRequests((prev) => mergeById(prev, [result.data]));
      } else if (!result.ok && result.status !== 'disabled') {
        setError(result.message);
      }
      setSavingId(null);
      return result;
    },
    [requests]
  );

  const summary = useMemo(() => buildFallbackCountSummary(requests), [requests]);

  return {
    requests,
    loading,
    savingId,
    error,
    sourceStatus,
    summary,
    refresh,
    createRequest,
    updateRequest,
    canManage,
    requesterCode,
    defaultRequesterLabel: requesterName || memberLabel(requesterCode),
  };
}
