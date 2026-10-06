import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchLedgerEditDataFromSupabase } from '../utils/ledgerSupabaseRead';
import { createLedgerApi, describeLedgerClientError } from '../utils/ledgerApiClient';
import { planLedgerChanges, stripLedgerMeta } from '../utils/ledgerDiff';
import { applyLedgerPlan, describeCounts } from '../utils/ledgerPlanRunner';
import { classifyLegacyDraft } from '../utils/ledgerLegacyDraft';
import { checkDeletionGuard } from '../utils/ledgerDeleteGuard';
import { buildTeamSnapshot, downloadTeamSnapshot } from '../utils/publishSnapshot';
import { loadUsageCategories } from '../constants/usageCategories';
import {
  clearStoredTransactions,
  loadStoredTransactions,
} from '../utils/transactionStorage';
import { prepareLedger } from './useTransactionLedger';

const VIEWER_MENU_SETTING_KEY = 'viewer_menu_visibility';

/**
 * 관리자 편집 화면용 서버(Supabase) 장부 읽기. 거래마다 낙관적 잠금용 `_version` 을 싣는다.
 * enabled 가 false 이면 아무것도 하지 않는다.
 */
export function useServerLedgerData(enabled) {
  const [state, setState] = useState({ loading: enabled, error: null, data: null });
  const seq = useRef(0);

  const reload = useCallback(async () => {
    if (!enabled) return null;
    const mine = ++seq.current;
    try {
      const data = await fetchLedgerEditDataFromSupabase();
      if (mine !== seq.current) return null;
      if (!data) {
        setState({ loading: false, error: 'Supabase 가 설정되지 않아 서버 장부를 불러올 수 없습니다.', data: null });
        return null;
      }
      setState({ loading: false, error: null, data });
      return data;
    } catch (e) {
      if (mine === seq.current) setState((s) => ({ ...s, loading: false, error: e?.message || '서버 장부를 불러오지 못했습니다.' }));
      return null;
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  return { ...state, reload };
}

/**
 * 이관 전 localStorage 작성본 점검. 서버 기준과 같으면 조용히 정리하고,
 * 다르면 `blocking` 으로 편집을 막은 채 백업 다운로드/폐기를 고르게 한다. 자동 업로드는 하지 않는다.
 */
export function useLegacyLedgerDraft({ enabled, serverTransactions, loaded }) {
  const [decision, setDecision] = useState(0); // 폐기 후 재판정을 위한 카운터
  const info = useMemo(() => {
    if (!enabled || !loaded) return { status: 'none', onlyLocal: 0, differing: 0, total: 0 };
    try {
      return classifyLegacyDraft(serverTransactions, loadStoredTransactions());
    } catch {
      return { status: 'diverged', onlyLocal: 0, differing: 0, total: 0 };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loaded, serverTransactions, decision]);

  useEffect(() => {
    if (info.status === 'identical') clearStoredTransactions();
  }, [info.status]);

  const downloadBackup = useCallback(() => {
    const draft = loadStoredTransactions() || [];
    downloadTeamSnapshot(buildTeamSnapshot(draft, loadUsageCategories()));
  }, []);

  const discard = useCallback(() => {
    clearStoredTransactions();
    setDecision((n) => n + 1);
  }, []);

  return { ...info, blocking: info.status === 'diverged', downloadBackup, discard };
}

/**
 * 서버 쓰기. App 은 기존 `updateTransactionsList(전체 목록)` 호출을 그대로 쓰고,
 * 여기서 변경분만 서버로 보낸다. 화면은 낙관적으로 먼저 바뀌고, 실패하면 서버 값으로 되돌린다.
 */
export function useServerLedgerWrites({ enabled, data, categories, blocked, blockedMessage, notify, reload }) {
  const api = useMemo(() => createLedgerApi(), []);
  const [txState, setTxState] = useState([]);
  const versionsRef = useRef(new Map());
  const queueRef = useRef(Promise.resolve());
  const txRef = useRef([]);
  const menuVersionRef = useRef(null);

  useEffect(() => {
    if (!enabled || !data) return;
    const next = prepareLedger(data.transactions, categories);
    versionsRef.current = new Map(data.transactions.map((t) => [t.id, t._version]));
    menuVersionRef.current = data.menuVersion;
    txRef.current = next;
    setTxState(next);
  }, [enabled, data, categories]);

  const enqueue = useCallback(
    (job, { successMessage } = {}) => {
      queueRef.current = queueRef.current.then(async () => {
        try {
          const result = await job();
          notify?.('success', typeof successMessage === 'function' ? successMessage(result) : successMessage);
        } catch (e) {
          notify?.('danger', describeLedgerClientError(e));
        } finally {
          await reload();
        }
      });
      return queueRef.current;
    },
    [notify, reload]
  );

  const updateTransactionsList = useCallback(
    (newList) => {
      if (!enabled) return;
      if (blocked) {
        notify?.('warning', blockedMessage || '서버 장부를 불러오는 중이거나 확인이 필요해 지금은 수정할 수 없습니다.');
        return;
      }
      let plan;
      try {
        plan = planLedgerChanges(txRef.current, newList);
      } catch (e) {
        notify?.('danger', e.message);
        return;
      }
      if (plan.isEmpty) return;
      const guard = checkDeletionGuard(plan.removes.length, txRef.current.length);
      if (!guard.ok) {
        notify?.('warning', guard.message);
        return;
      }
      const optimistic = prepareLedger(newList, categories);
      txRef.current = optimistic;
      setTxState(optimistic);
      enqueue(() => applyLedgerPlan(api, plan, { versions: versionsRef.current }), {
        successMessage: (counts) =>
          `서버에 저장했습니다 (${describeCounts(counts)}). 팀원 조회 화면에 바로 반영됩니다.`,
      });
    },
    [enabled, blocked, blockedMessage, notify, categories, enqueue, api]
  );

  const saveCategories = useCallback(
    (list) => {
      if (!enabled || blocked) return Promise.resolve();
      return enqueue(() => api.putCategories(list), { successMessage: '사용 유형을 서버에 저장했습니다.' });
    },
    [enabled, blocked, enqueue, api]
  );

  const saveMenuVisibility = useCallback(
    (visibility) => {
      if (!enabled || blocked) return Promise.resolve();
      return enqueue(
        async () => {
          const res = await api.putSetting(VIEWER_MENU_SETTING_KEY, visibility, menuVersionRef.current);
          menuVersionRef.current = res?.setting?.version ?? menuVersionRef.current;
        },
        { successMessage: '조회 화면 메뉴 설정을 서버에 저장했습니다. 바로 반영됩니다.' }
      );
    },
    [enabled, blocked, enqueue, api]
  );

  /** JSON 백업 가져오기: 병합(기본) 또는 교체(confirmReplace). 카테고리·메뉴 설정도 함께 반영. */
  const importSnapshot = useCallback(
    ({ transactions, categories: cats, menuVisibility, replace = false }) => {
      if (!enabled || blocked) return Promise.resolve();
      return enqueue(
        async () => {
          if (cats?.length) await api.putCategories(cats);
          if (menuVisibility) {
            const res = await api.putSetting(VIEWER_MENU_SETTING_KEY, menuVisibility, menuVersionRef.current);
            menuVersionRef.current = res?.setting?.version ?? menuVersionRef.current;
          }
          return api.bulkTransactions(stripLedgerMeta(transactions), {
            mode: replace ? 'replace' : 'merge',
            confirmReplace: replace,
          });
        },
        {
          successMessage: (r) =>
            `백업을 서버에 반영했습니다 (추가 ${r.added} · 수정 ${r.updated}${r.removed ? ` · 삭제 ${r.removed}` : ''}).`,
        }
      );
    },
    [enabled, blocked, enqueue, api]
  );

  return {
    transactions: txState,
    updateTransactionsList,
    saveCategories,
    saveMenuVisibility,
    importSnapshot,
    resetToBundledData: () => notify?.('warning', '서버 장부 모드에서는 초기 데이터로 되돌릴 수 없습니다.'),
    pullFromPublished: () => ({ ok: false, reason: 'server-mode' }),
    syncStatus: 'in-sync',
    markPublishedLocally: () => {},
  };
}
