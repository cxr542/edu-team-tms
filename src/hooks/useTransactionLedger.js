import { useCallback, useEffect, useMemo, useState } from 'react';
import teamBuildingData from '../data/teamBuilding2026.json';
import { normalizeTransaction } from '../constants/usageCategories';
import { calculateBalances } from '../utils/ledgerBalances';
import { getLedgerSyncStatus } from '../utils/ledgerSync';
import {
  clearStoredTransactions,
  loadLedgerMeta,
  loadStoredTransactions,
  saveLedgerMeta,
  saveStoredTransactions,
} from '../utils/transactionStorage';

function prepareLedger(rawList, categories) {
  const normalized = rawList.map((tx) => normalizeTransaction(tx, categories));
  return calculateBalances(normalized);
}

function touchLocalMeta(partial = {}) {
  const prev = loadLedgerMeta();
  const next = {
    ...prev,
    ...partial,
    updatedAt: partial.updatedAt ?? new Date().toISOString(),
  };
  saveLedgerMeta(next);
  return next;
}

export function shouldAdoptPublishedSnapshot({
  readOnly,
  storedTransactions,
  publishedSnapshot,
  ledgerMeta,
}) {
  if (readOnly || !publishedSnapshot?.transactions?.length) return false;

  // Safety first: never overwrite an existing editable local ledger automatically.
  // Published snapshots can still be pulled explicitly through the UI action.
  if (storedTransactions?.length) return false;

  return true;
}

function ledgerSeedComparisonKey(tx) {
  return JSON.stringify({
    id: tx?.id || '',
    date: tx?.date || '',
    description: tx?.description || '',
    amount: Number(tx?.amount) || 0,
    category: tx?.category || '',
    paymentMethod: tx?.paymentMethod || '',
    attendees: tx?.attendees || '',
  });
}

export function isImplicitBundledLedgerSeed({ storedTransactions, categories, ledgerMeta }) {
  if (!storedTransactions?.length) return false;
  if (ledgerMeta?.updatedAt || ledgerMeta?.syncedPublishedAt) return false;

  const bundled = prepareLedger(teamBuildingData, categories);
  if (storedTransactions.length !== bundled.length) return false;

  return storedTransactions.every(
    (tx, index) => ledgerSeedComparisonKey(tx) === ledgerSeedComparisonKey(bundled[index])
  );
}

function countByYearMonth(transactions = []) {
  return transactions.reduce((acc, tx) => {
    const ym = String(tx?.date || '').slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(ym)) {
      acc[ym] = (acc[ym] || 0) + 1;
    }
    return acc;
  }, {});
}

export function validateLedgerSnapshotAdoption(currentTransactions = [], incomingTransactions = []) {
  if (!currentTransactions.length || !incomingTransactions.length) {
    return { ok: true };
  }

  if (incomingTransactions.length < currentTransactions.length) {
    return {
      ok: false,
      reason: 'transaction-count-decrease',
      currentCount: currentTransactions.length,
      incomingCount: incomingTransactions.length,
    };
  }

  const currentMonths = countByYearMonth(currentTransactions);
  const incomingMonths = countByYearMonth(incomingTransactions);
  const removedMonth = Object.keys(currentMonths).find(
    (ym) => currentMonths[ym] > 0 && !incomingMonths[ym]
  );

  if (removedMonth) {
    return {
      ok: false,
      reason: 'month-data-removed',
      month: removedMonth,
      currentCount: currentMonths[removedMonth],
      incomingCount: incomingMonths[removedMonth] || 0,
    };
  }

  return { ok: true };
}

export function useTransactionLedger(categories, options = {}) {
  const { readOnly = false, seedTransactions = null, publishedSnapshot = null } = options;

  const [ledgerState, setLedgerState] = useState(() => {
    if (seedTransactions?.length) {
      return {
        transactions: prepareLedger(seedTransactions, categories),
        usingBundledSeed: false,
      };
    }
    if (readOnly) {
      return {
        transactions: [],
        usingBundledSeed: false,
      };
    }
    const stored = loadStoredTransactions();
    const base = stored?.length ? stored : teamBuildingData;
    return {
      transactions: prepareLedger(base, categories),
      usingBundledSeed: !stored?.length,
    };
  });
  const { transactions, usingBundledSeed } = ledgerState;

  const [meta, setMeta] = useState(() => loadLedgerMeta());

  useEffect(() => {
    if (!seedTransactions?.length) return;
    setLedgerState({
      transactions: prepareLedger(seedTransactions, categories),
      usingBundledSeed: false,
    });
  }, [seedTransactions, categories]);

  const applyPublished = useCallback(
    (snap, { markSynced = true } = {}) => {
      if (!snap?.transactions?.length) return { ok: false, reason: 'empty' };
      const next = prepareLedger(snap.transactions, categories);
      const currentTransactions = usingBundledSeed ? [] : transactions;
      const validation = validateLedgerSnapshotAdoption(currentTransactions, next);
      if (!validation.ok) return validation;
      setLedgerState({ transactions: next, usingBundledSeed: false });
      const publishedAt = snap.publishedAt || new Date().toISOString();
      const nextMeta = markSynced
        ? { updatedAt: publishedAt, syncedPublishedAt: publishedAt }
        : { updatedAt: publishedAt };
      saveLedgerMeta(nextMeta);
      setMeta(nextMeta);
      saveStoredTransactions(next);
      return { ok: true, count: next.length };
    },
    [categories, transactions, usingBundledSeed]
  );

  useEffect(() => {
    const storedTransactions = loadStoredTransactions();
    const localTransactions =
      usingBundledSeed ||
      isImplicitBundledLedgerSeed({
        storedTransactions,
        categories,
        ledgerMeta: meta,
      })
        ? []
        : storedTransactions;

    if (
      !shouldAdoptPublishedSnapshot({
        readOnly,
        storedTransactions: localTransactions,
        publishedSnapshot,
        ledgerMeta: meta,
      })
    ) {
      return;
    }
    applyPublished(publishedSnapshot);
  }, [readOnly, publishedSnapshot, applyPublished, meta, categories, usingBundledSeed]);

  const pullFromPublished = useCallback(
    (snap = publishedSnapshot) => {
      if (readOnly) return { ok: false, reason: 'readonly' };
      return applyPublished(snap, { markSynced: true });
    },
    [readOnly, publishedSnapshot, applyPublished]
  );

  const syncStatus = useMemo(
    () =>
      getLedgerSyncStatus({
        publishedAt: publishedSnapshot?.publishedAt,
        localUpdatedAt: meta.updatedAt,
        syncedPublishedAt: meta.syncedPublishedAt,
      }),
    [publishedSnapshot?.publishedAt, meta.updatedAt, meta.syncedPublishedAt]
  );

  useEffect(() => {
    if (readOnly || usingBundledSeed) return;
    saveStoredTransactions(transactions);
  }, [transactions, readOnly, usingBundledSeed]);

  const updateTransactionsList = useCallback(
    (newList) => {
      if (readOnly) return;
      setLedgerState({
        transactions: prepareLedger(newList, categories),
        usingBundledSeed: false,
      });
      setMeta(touchLocalMeta());
    },
    [categories, readOnly]
  );

  const resetToBundledData = useCallback(() => {
    if (readOnly) return;
    clearStoredTransactions();
    setMeta({});
    setLedgerState({
      transactions: prepareLedger(teamBuildingData, categories),
      usingBundledSeed: true,
    });
  }, [categories, readOnly]);

  const markPublishedLocally = useCallback((publishedAt) => {
    const at = publishedAt || new Date().toISOString();
    const nextMeta = { updatedAt: at, syncedPublishedAt: at };
    saveLedgerMeta(nextMeta);
    setMeta(nextMeta);
  }, []);

  return {
    transactions,
    updateTransactionsList,
    resetToBundledData,
    bundledCount: teamBuildingData.length,
    pullFromPublished,
    syncStatus,
    ledgerMeta: meta,
    markPublishedLocally,
  };
}
