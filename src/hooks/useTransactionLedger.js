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
  if (!storedTransactions?.length) return true;
  if (!ledgerMeta?.updatedAt) return true;
  const syncStatus = getLedgerSyncStatus({
    publishedAt: publishedSnapshot.publishedAt,
    localUpdatedAt: ledgerMeta?.updatedAt,
    syncedPublishedAt: ledgerMeta?.syncedPublishedAt,
  });
  return syncStatus === 'remote-ahead';
}

export function useTransactionLedger(categories, options = {}) {
  const { readOnly = false, seedTransactions = null, publishedSnapshot = null } = options;

  const [transactions, setTransactions] = useState(() => {
    if (seedTransactions?.length) {
      return prepareLedger(seedTransactions, categories);
    }
    if (readOnly) return [];
    const stored = loadStoredTransactions();
    const base = stored?.length ? stored : teamBuildingData;
    return prepareLedger(base, categories);
  });

  const [meta, setMeta] = useState(() => loadLedgerMeta());

  useEffect(() => {
    if (!seedTransactions?.length) return;
    setTransactions(prepareLedger(seedTransactions, categories));
  }, [seedTransactions, categories]);

  const applyPublished = useCallback(
    (snap, { markSynced = true } = {}) => {
      if (!snap?.transactions?.length) return { ok: false, reason: 'empty' };
      const next = prepareLedger(snap.transactions, categories);
      setTransactions(next);
      const publishedAt = snap.publishedAt || new Date().toISOString();
      const nextMeta = markSynced
        ? { updatedAt: publishedAt, syncedPublishedAt: publishedAt }
        : { updatedAt: publishedAt };
      saveLedgerMeta(nextMeta);
      setMeta(nextMeta);
      saveStoredTransactions(next);
      return { ok: true, count: next.length };
    },
    [categories]
  );

  useEffect(() => {
    if (
      !shouldAdoptPublishedSnapshot({
        readOnly,
        storedTransactions: loadStoredTransactions(),
        publishedSnapshot,
        ledgerMeta: meta,
      })
    ) {
      return;
    }
    applyPublished(publishedSnapshot);
  }, [readOnly, publishedSnapshot, applyPublished, meta]);

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
    if (readOnly) return;
    saveStoredTransactions(transactions);
  }, [transactions, readOnly]);

  const updateTransactionsList = useCallback(
    (newList) => {
      if (readOnly) return;
      setTransactions(prepareLedger(newList, categories));
      setMeta(touchLocalMeta());
    },
    [categories, readOnly]
  );

  const resetToBundledData = useCallback(() => {
    if (readOnly) return;
    clearStoredTransactions();
    setMeta({});
    setTransactions(prepareLedger(teamBuildingData, categories));
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
