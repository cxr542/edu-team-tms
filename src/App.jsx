import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Copy,
  Filter, 
  CheckCircle, 
  Calendar,
  Sparkles,
  CreditCard,
  UserCheck,
  ChevronDown,
  ChevronUp,
  DollarSign,
  TrendingUp,
  AlertCircle,
  X,
  PieChart,
  Settings,
  MessageSquare,
  Share2,
  Eye,
  RefreshCw,
  Import,
} from 'lucide-react';
import { parseExcelFile, exportToExcel } from './utils/excelParser';
import confetti from 'canvas-confetti';
import {
  loadUsageCategories,
  DEFAULT_ATTENDEES,
  normalizeTransaction,
  normalizeAttendees,
  getCategoryStyle,
} from './constants/usageCategories';
import { useUsageCategories } from './hooks/useUsageCategories';
import { useTransactionLedger } from './hooks/useTransactionLedger';
import { usePublicSnapshot } from './hooks/usePublicSnapshot';
import { useAutoPublishLedger } from './hooks/useAutoPublishLedger';
import CategoryManageModal from './components/CategoryManageModal';
import CardPasteModal from './components/CardPasteModal';
import { MONTHLY_BUDGET } from './utils/ledgerBalances';
import {
  cloneLedgerTransaction,
  getLedgerYearOptions,
  getPreviousMonth,
  getTodayLedgerPeriod,
  transactionDedupeKey,
} from './utils/ledgerCopy';
import { isViewerMode, formatPublishedAt } from './utils/appMode';
import { URL_ACCESS_LEADER } from './constants/teamAccess';
import {
  canEditLedger,
  isLedgerReadOnly,
  isMemberLedgerScope,
  usesPublishedLedgerData as resolveUsesPublishedLedgerData,
} from './utils/ledgerAccess';
import { canAttemptCloudWrite, getCloudHealthUserMessage } from './utils/cloudHealth';
import { describeLedgerPublishFailure } from './utils/ledgerPublishUi';
import {
  buildTeamSnapshot,
  downloadTeamSnapshot,
  EMPTY_LEDGER_SNAPSHOT_DETAIL,
  EMPTY_LEDGER_SNAPSHOT_TITLE,
  fetchPublicSnapshot,
  publishSnapshotToServer,
} from './utils/publishSnapshot';
import AppShell from './components/AppShell';
import WeeklyJournalPage from './pages/WeeklyJournalPage';
import TeamKpiPage from './pages/TeamKpiPage';
import CompetencyPage from './pages/CompetencyPage';
import KpiApprovePage from './pages/KpiApprovePage';
import KpiReportPage from './pages/KpiReportPage';
import { useTeamAccess } from './hooks/useTeamAccess';
import ReferenceDocsPage from './pages/ReferenceDocsPage';
import AcademizerEmbedPage from './pages/AcademizerEmbedPage';
import CloudChatbotEmbedPage from './pages/CloudChatbotEmbedPage';
import LunchPickPage from './pages/LunchPickPage';
import IdeaBankPage from './pages/IdeaBankPage';
import { isProductionEnvironment } from './constants/appEnv';
import { uiTooltip } from './utils/uiTooltip';
import { JournalProvider } from './context/JournalProvider';
import { isKpiRelatedModule, useAppModule } from './hooks/useAppModule';
import { findReferenceDoc } from './constants/referenceDocs';
import { useNavLabels } from './hooks/useNavLabels';
import { useViewerMenuVisibility } from './hooks/useViewerMenuVisibility';
import {
  DEFAULT_VIEWER_MENU_VISIBILITY,
  normalizeViewerMenuVisibility,
  resolveViewerModule,
} from './constants/viewerMenu';
import ViewerMenuSettingsModal from './components/ViewerMenuSettingsModal';
import UsageStandardsPanel from './components/UsageStandardsPanel';

const LEDGER_SNAPSHOT_REFRESH_LABEL = '조회 데이터 새로고침';
const LEDGER_SNAPSHOT_REFRESH_TITLE =
  '저장된 조회용 장부 snapshot을 다시 불러옵니다. 장부 데이터는 수정하지 않습니다.';

function sanitizeExtraData(extraData) {
  const base = { 영수증번호: '', 비고: '' };
  if (!extraData || typeof extraData !== 'object') return base;
  const next = { ...base };
  Object.entries(extraData).forEach(([k, v]) => {
    if (!k || k === 'undefined') return;
    next[k] = v == null ? '' : String(v);
  });
  return next;
}

function CategoryBadge({ label, categories }) {
  const style = getCategoryStyle(label, categories);
  return (
    <span
      className="badge badge-default"
      style={{
        backgroundColor: `${style.color}22`,
        color: style.color,
        border: `1px solid ${style.color}40`,
      }}
    >
      {label}
    </span>
  );
}


function LoadingScreen({ message = '장부를 불러오는 중…', inline = false }) {
  return (
    <div
      className="project-app theme-tms"
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: inline ? '12rem' : '100vh',
        display: 'flex',
        padding: inline ? '2rem 1rem' : undefined,
      }}
    >
      <p style={{ color: 'var(--text-secondary)' }}>{message}</p>
    </div>
  );
}

export default function App() {
  const isViewer = isViewerMode();
  const { module, setModule } = useAppModule();
  const teamAccess = useTeamAccess();
  const accessParam =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('access') : null;
  const isMemberLedger = isMemberLedgerScope({ module, isMemberScope: teamAccess.isMemberScope });
  /** 공개 조회·구성원 장부 — mode와 무관하게 read-only */
  const ledgerReadOnly = isLedgerReadOnly({
    isViewer,
    module,
    isMemberScope: teamAccess.isMemberScope,
  });
  const usesPublishedLedgerData = resolveUsesPublishedLedgerData({
    isViewer,
    isMemberScope: teamAccess.isMemberScope,
  });
  const canEditLedgerNow = canEditLedger({
    isViewer,
    module,
    isMemberScope: teamAccess.isMemberScope,
    isLeader: teamAccess.isLeader,
    accessParam,
  });
  /** 공개 조회(?mode=view)만 상세 접기 — 구성원 B/C 장부는 거래 목록 항상 표시 */
  const ledgerDetailsCollapsible = isViewer && !teamAccess.isMemberScope;
  const isLeaderEditAccess = accessParam === URL_ACCESS_LEADER;
  /** 팀장 편집(?mode=edit&access=leader) 장부에서만 엑셀 내보내기 */
  const canExportLedgerExcel = !isViewer && isLeaderEditAccess;
  const {
    visibility: viewerMenuVisibility,
    applyVisibility: applyViewerMenuVisibility,
  } = useViewerMenuVisibility();
  const [viewerMenuSettingsOpen, setViewerMenuSettingsOpen] = useState(false);

  const { labels: navLabels, updateLabel: onNavLabelSave, resetLabels: onNavLabelsReset, defaults: navDefaults } =
    useNavLabels();
  const provisionalDisplayModule = isViewer ? resolveViewerModule(module, viewerMenuVisibility) : module;
  const ledgerSnapshotEnabled = provisionalDisplayModule === 'ledger';
  const {
    loading,
    error,
    warning: snapshotWarning,
    snapshotEmpty,
    data: snapshot,
    reload,
    refreshing,
    reloadBlockedByCooldown,
  } = usePublicSnapshot(ledgerSnapshotEnabled, {
    pollMs: 0,
    reloadCooldownMs: 30000,
  });
  const sharedViewerMenuVisibility = useMemo(
    () => normalizeViewerMenuVisibility(snapshot?.viewerMenuVisibility),
    [snapshot?.publishedAt, snapshot?.viewerMenuVisibility]
  );
  const activeViewerMenuVisibility =
    isViewer && snapshot?.viewerMenuVisibility ? sharedViewerMenuVisibility : viewerMenuVisibility;
  const displayModule = isViewer ? resolveViewerModule(module, activeViewerMenuVisibility) : module;

  useEffect(() => {
    if (!isViewer) return;
    const resolved = resolveViewerModule(module, activeViewerMenuVisibility);
    if (resolved !== module) setModule('ledger');
  }, [isViewer, module, activeViewerMenuVisibility, setModule]);

  useEffect(() => {
    if (isViewer) return;
    if (teamAccess.canAccessModule(module)) return;
    const target = teamAccess.redirectUrlForForbidden;
    window.history.replaceState({}, '', target);
    const nextModule = new URL(target, window.location.origin).searchParams.get('module') || 'journal';
    setModule(nextModule);
  }, [isViewer, module, teamAccess, setModule]);

  /** ?doc=tms-bookmarks 등은 참고문서(module=docs)에서만 표시 */
  useEffect(() => {
    if (isViewer) return;
    const params = new URLSearchParams(window.location.search);
    const docId = params.get('doc');
    if (!docId || !findReferenceDoc(docId)) return;
    if (params.get('module') === 'docs') return;
    params.set('module', 'docs');
    window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
    setModule('docs');
  }, [isViewer, setModule]);

  const seedCategories = useMemo(() => {
    if (!usesPublishedLedgerData || !snapshot?.categories?.length) return null;
    return snapshot.categories;
  }, [usesPublishedLedgerData, snapshot?.publishedAt, snapshot?.categories]);

  const seedTransactions = useMemo(() => {
    if (!usesPublishedLedgerData || !snapshot?.transactions?.length) return null;
    return snapshot.transactions;
  }, [usesPublishedLedgerData, snapshot?.publishedAt, snapshot?.transactions]);

  const {
    categories,
    addCategory,
    updateCategory: updateCategoryDef,
    removeCategory,
    resetToDefault,
    setCategories,
  } = useUsageCategories({ readOnly: usesPublishedLedgerData, seedCategories });

  const {
    transactions,
    updateTransactionsList,
    resetToBundledData,
    pullFromPublished,
    syncStatus,
    markPublishedLocally,
  } = useTransactionLedger(categories, {
    readOnly: usesPublishedLedgerData,
    seedTransactions,
    publishedSnapshot: snapshot,
  });

  const onLivePublishSuccess = useCallback(
    (payload) => {
      markPublishedLocally(payload.publishedAt);
      reload({ quiet: true, force: true });
    },
    [markPublishedLocally, reload]
  );

  const [livePublishBlocked, setLivePublishBlocked] = useState(false);
  const [livePublishBlockReason, setLivePublishBlockReason] = useState(null); // 'not-configured' | 'quota-exceeded'

  const autoPublish = useAutoPublishLedger({
    enabled: canEditLedgerNow,
    transactions,
    categories,
    viewerMenuVisibility: activeViewerMenuVisibility,
    onSuccess: (payload) => {
      setLivePublishBlocked(false);
      setLivePublishBlockReason(null);
      onLivePublishSuccess(payload);
    },
    onFail: (result) => {
      if (
        result.reason === 'not-configured' ||
        result.reason === 'quota-exceeded' ||
        result.reason === 'cloud-limited'
      ) {
        setLivePublishBlocked(true);
        setLivePublishBlockReason(result.reason === 'cloud-limited' ? 'quota-exceeded' : result.reason);
      }
    },
  });

  const [filteredTransactions, setFilteredTransactions] = useState(transactions);
  const [isCategoryManageOpen, setIsCategoryManageOpen] = useState(false);
  const [isCardPasteOpen, setIsCardPasteOpen] = useState(false);
  
  const todayPeriod = useMemo(() => getTodayLedgerPeriod(), []);
  const ledgerYearOptions = useMemo(() => getLedgerYearOptions(), []);

  const [selectedYear, setSelectedYear] = useState(todayPeriod.year);
  const [selectedMonth, setSelectedMonth] = useState(todayPeriod.month);

  /** 조회(공개) 화면: 지출 상세·목록은 잔액 카드 「상세보기」로만 펼침 (구성원 장부 제외) */
  const [viewerDetailsOpen, setViewerDetailsOpen] = useState(false);
  const viewerDetailsRef = useRef(null);
  const showLedgerDetails = !ledgerDetailsCollapsible || viewerDetailsOpen;
  
  // 검색 및 상세 필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [selectedTxIds, setSelectedTxIds] = useState([]);
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);

  // 모달 관리 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [currentTx, setCurrentTx] = useState({
    id: '',
    date: '',
    category: loadUsageCategories()[0]?.label || '기타',
    description: '',
    amount: 0,
    balance: 0,
    paymentMethod: '법인카드',
    attendees: DEFAULT_ATTENDEES,
    extraData: {}
  });

  // 시스템 실시간 알림 상태
  const [alert, setAlert] = useState({ show: false, message: '', type: 'info' });
  const [importingProdLedger, setImportingProdLedger] = useState(false);
  const fileInputRef = useRef(null);
  const ledgerToolbarSentinelRef = useRef(null);
  const ledgerToolbarRef = useRef(null);
  const [ledgerToolbarPinned, setLedgerToolbarPinned] = useState(false);
  const [ledgerToolbarHeight, setLedgerToolbarHeight] = useState(0);

  const updateLedgerToolbarPin = useCallback(() => {
    if (ledgerReadOnly) {
      setLedgerToolbarPinned(false);
      return;
    }
    const sentinel = ledgerToolbarSentinelRef.current;
    const toolbar = ledgerToolbarRef.current;
    if (!sentinel || !toolbar) return;
    const shouldPin = sentinel.getBoundingClientRect().top < 0;
    const { height } = toolbar.getBoundingClientRect();
    setLedgerToolbarPinned(shouldPin);
    if (height > 0) {
      setLedgerToolbarHeight((prev) => (Math.abs(prev - height) < 0.5 ? prev : height));
    }
  }, [ledgerReadOnly]);

  useEffect(() => {
    if (ledgerReadOnly) return undefined;
    updateLedgerToolbarPin();
    const main = document.querySelector('.main-content');
    const onScroll = () => requestAnimationFrame(updateLedgerToolbarPin);
    main?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    const toolbar = ledgerToolbarRef.current;
    const ro = toolbar ? new ResizeObserver(onScroll) : null;
    if (toolbar && ro) ro.observe(toolbar);
    return () => {
      main?.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      ro?.disconnect();
    };
  }, [
    ledgerReadOnly,
    updateLedgerToolbarPin,
    filteredTransactions.length,
    searchTerm,
    categoryFilter,
    paymentFilter,
    selectedYear,
    selectedMonth,
  ]);

  // 알림 노출 헬퍼
  const showAlert = (message, type = 'info', durationMs = 4500) => {
    setAlert({ show: true, message, type });
    setTimeout(() => {
      setAlert({ show: false, message: '', type: 'info' });
    }, durationMs);
  };

  const toggleViewerDetails = useCallback(() => {
    setViewerDetailsOpen((open) => {
      const next = !open;
      if (next) {
        requestAnimationFrame(() => {
          const main = document.querySelector('.main-content');
          const target = viewerDetailsRef.current;
          if (main && target) {
            const top = target.offsetTop - 16;
            main.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
          }
        });
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!ledgerReadOnly) setViewerDetailsOpen(false);
  }, [ledgerReadOnly, selectedYear, selectedMonth]);

  const notifyLedgerChanged = (baseMessage) => {
    if (isViewer) {
      showAlert(baseMessage, 'success');
      return;
    }
    if (autoPublish.liveReady) {
      showAlert(`${baseMessage} 조회 페이지에 자동 반영됩니다.`, 'success', 3500);
      return;
    }
    if (livePublishBlocked) {
      showAlert(
        `${baseMessage} (실시간 반영: Vercel Blob 미연결 — 아래 안내 또는 「지금 조회에 반영」)`,
        'warning',
        6000
      );
      return;
    }
    showAlert(`${baseMessage} 조회 페이지 동기화 중…`, 'success', 3000);
  };

  // 장부 데이터가 변경될 때마다 날짜순으로 재정렬하고 잔액(Balance)을 순차적으로 자동 계산하는 로직
  // 매월 150,000원씩 독자적으로 할당되므로 월별 할당금액 기준 잔고 흐름을 계산합니다.
  // (calculateBalances → useTransactionLedger / ledgerBalances.js)

  const updateCategory = (id, draft) => {
    const prev = categories.find((c) => c.id === id);
    const result = updateCategoryDef(id, draft);
    if (result.ok && prev && prev.label !== String(draft.label).trim()) {
      const nextLabel = String(draft.label).trim();
      updateTransactionsList(
        transactions.map((t) => (t.category === prev.label ? { ...t, category: nextLabel } : t))
      );
    }
    return result;
  };

  const handleCardPasteApply = (draft) => {
    const tx = normalizeTransaction(
      {
        id: `tx-kakao-${Date.now()}`,
        ...draft,
        balance: 0,
        extraData: sanitizeExtraData(draft.extraData),
      },
      categories
    );
    updateTransactionsList([...transactions, tx]);
    notifyLedgerChanged('법인카드 알림 내용이 작성 장부에 반영되었습니다.');
  };

  const unpublishedToView = useMemo(() => {
    if (isViewer || !snapshot?.transactions?.length) return [];
    const publishedIds = new Set(snapshot.transactions.map((t) => t.id));
    return transactions.filter((t) => !publishedIds.has(t.id));
  }, [isViewer, snapshot, transactions]);

  const handlePublishForTeam = async () => {
    const remote = await autoPublish.publishNow();
    if (remote?.ok) {
      setLivePublishBlocked(false);
      setLivePublishBlockReason(null);
      showAlert(`조회 페이지에 ${transactions.length}건을 반영했습니다.`, 'success', 5000);
      return;
    }
    const failure = describeLedgerPublishFailure(remote);
    if (failure.blockLivePublish) {
      setLivePublishBlocked(true);
      setLivePublishBlockReason(failure.isQuota ? 'quota-exceeded' : remote?.reason || 'not-configured');
    }
    showAlert(failure.userMessage, 'warning', 12000);
  };

  const handleDownloadLedgerBackup = () => {
    const payload = buildTeamSnapshot(transactions, categories, activeViewerMenuVisibility);
    downloadTeamSnapshot(payload);
    showAlert('장부 JSON 백업 파일(ledger-snapshot.json)을 다운로드했습니다.', 'info', 5000);
  };

  const ledgerPublishBlocked =
    livePublishBlocked || !canAttemptCloudWrite();
  const ledgerPublishBlockTooltip =
    getCloudHealthUserMessage() ||
    (livePublishBlocked
      ? 'Blob 제한 상태에서는 조회 반영이 실패할 수 있습니다. 로컬 데이터는 유지됩니다.'
      : '조회 URL에 즉시 반영 (서버 Blob publish)');

  const handleApplyViewerMenuVisibility = useCallback(
    async (next) => {
      const normalized = normalizeViewerMenuVisibility(next);
      applyViewerMenuVisibility(normalized);
      if (isViewer) return;

      const payload = buildTeamSnapshot(transactions, categories, normalized);
      const remote = await publishSnapshotToServer(payload);
      if (remote?.ok) {
        setLivePublishBlocked(false);
        setLivePublishBlockReason(null);
        markPublishedLocally(payload.publishedAt);
        reload({ quiet: true });
        showAlert('조회 화면 메뉴 변경이 즉시 반영되었습니다.', 'success', 4200);
        return;
      }

      showAlert(
        remote?.message || '조회 메뉴 즉시 반영에 실패했습니다. 「지금 조회에 반영」을 눌러 다시 시도해 주세요.',
        'warning',
        6500
      );
    },
    [applyViewerMenuVisibility, isViewer, transactions, categories, markPublishedLocally, reload]
  );

  const handleResetViewerMenuVisibility = useCallback(() => {
    handleApplyViewerMenuVisibility({ ...DEFAULT_VIEWER_MENU_VISIBILITY });
  }, [handleApplyViewerMenuVisibility]);

  const handlePullFromPublished = () => {
    if (!snapshot?.transactions?.length) {
      showAlert('조회용 공개 장부(ledger-snapshot.json)를 아직 불러오지 못했습니다.', 'danger');
      return;
    }
    if (
      syncStatus === 'local-ahead' &&
      !window.confirm('작성 중인 내용이 조회 화면보다 최신일 수 있습니다. 조회용 데이터로 덮어쓸까요?')
    ) {
      return;
    }
    const r = pullFromPublished(snapshot);
    if (snapshot.categories?.length) {
      setCategories(snapshot.categories);
    }
    if (r.ok) {
      showAlert(`조회 화면 데이터 ${r.count}건을 작성 장부에 반영했습니다.`, 'success');
    }
  };

  const handleImportProdLedger = async () => {
    if (
      !window.confirm(
        '운영 장부 데이터를 현재 개발환경 편집본으로 가져옵니다. 현재 localhost 장부 편집 내용은 덮어써질 수 있습니다. 계속할까요?'
      )
    ) {
      return;
    }
    setImportingProdLedger(true);
    try {
      autoPublish.suppressNextPublish();
      const remote = await fetchPublicSnapshot();
      const r = pullFromPublished(remote);
      if (remote.categories?.length) {
        setCategories(remote.categories);
      }
      if (r.ok) {
        await reload({ quiet: true });
        showAlert(`운영 장부 ${r.count}건을 개발 편집본에 반영했습니다.`, 'success');
      } else {
        showAlert('운영 장부 데이터가 비어 있어 반영하지 못했습니다.', 'warning');
      }
    } catch (err) {
      const detail = err?.message ? ` (${err.message})` : '';
      showAlert(`운영 장부 가져오기에 실패했습니다.${detail}`, 'danger');
    } finally {
      setImportingProdLedger(false);
    }
  };

  const showDevProdLedgerImport =
    !isProductionEnvironment() &&
    displayModule === 'ledger' &&
    canEditLedgerNow &&
    !isViewer &&
    teamAccess.isLeader;

  // 필터링된 현재 월의 지출 데이터 집계
  const monthlyBudget = MONTHLY_BUDGET;
  
  // 선택된 연도와 월의 총 지출액 계산
  const currentMonthTxs = transactions.filter(t => {
    const [y, m] = t.date.split('-');
    return y === selectedYear && m === selectedMonth;
  });

  const totalSpent = currentMonthTxs.reduce((sum, t) => sum + t.amount, 0);
  const remainingBalance = monthlyBudget - totalSpent;
  const usagePercent =
    monthlyBudget > 0 ? Math.round((totalSpent / monthlyBudget) * 100) : 0;
  const spentPercent = Math.min(usagePercent, 100);

  // 실시간 다중 조건 필터링 적용 (연도/월 필터 + 검색어 + 유형 + 결제수단)
  useEffect(() => {
    let result = [...transactions];

    // 1. 연도 및 월 필터 적용
    result = result.filter(t => {
      const [y, m] = t.date.split('-');
      return y === selectedYear && m === selectedMonth;
    });

    // 2. 검색어 매칭 (내역, 참석자, 카테고리)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.description.toLowerCase().includes(term) ||
        t.attendees.toLowerCase().includes(term) ||
        t.category.toLowerCase().includes(term) ||
        t.paymentMethod.toLowerCase().includes(term)
      );
    }

    // 3. 카테고리 필터
    if (categoryFilter !== 'All') {
      result = result.filter(t => t.category === categoryFilter);
    }

    // 4. 결제 수단 필터
    if (paymentFilter !== 'All') {
      result = result.filter(t => t.paymentMethod === paymentFilter);
    }

    setFilteredTransactions(result);
  }, [transactions, selectedYear, selectedMonth, searchTerm, categoryFilter, paymentFilter]);

  const exitBulkDeleteMode = useCallback(() => {
    setBulkDeleteMode(false);
    setSelectedTxIds([]);
  }, []);

  useEffect(() => {
    if (ledgerReadOnly) {
      exitBulkDeleteMode();
      return;
    }
    const visible = new Set(filteredTransactions.map((t) => t.id));
    setSelectedTxIds((prev) => prev.filter((id) => visible.has(id)));
  }, [ledgerReadOnly, filteredTransactions, selectedYear, selectedMonth, exitBulkDeleteMode]);

  useEffect(() => {
    exitBulkDeleteMode();
  }, [selectedYear, selectedMonth, exitBulkDeleteMode]);

  const selectedCount = selectedTxIds.length;
  const allVisibleSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((t) => selectedTxIds.includes(t.id));
  const someVisibleSelected =
    filteredTransactions.some((t) => selectedTxIds.includes(t.id)) && !allVisibleSelected;

  const hasExtraTableFilter =
    Boolean(searchTerm) || categoryFilter !== 'All' || paymentFilter !== 'All';

  const visibleBulkDeleteLabel = hasExtraTableFilter
    ? `필터 결과 일괄 삭제 (${filteredTransactions.length}건)`
    : `${parseInt(selectedMonth, 10)}월 전체 삭제 (${filteredTransactions.length}건)`;

  const toggleTxSelection = (id) => {
    setSelectedTxIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredTransactions.map((t) => t.id);
    if (allVisibleSelected) {
      const visibleSet = new Set(visibleIds);
      setSelectedTxIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setSelectedTxIds((prev) => [...new Set([...prev, ...visibleIds])]);
    }
  };

  const removeTransactionsByIds = (ids, successMessage) => {
    const idSet = new Set(ids);
    if (idSet.size === 0) return;
    updateTransactionsList(transactions.filter((t) => !idSet.has(t.id)));
    setSelectedTxIds((prev) => prev.filter((id) => !idSet.has(id)));
    notifyLedgerChanged(successMessage);
  };

  // 엑셀 파싱 업로드 완료 핸들러
  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      showAlert('지출 장부 엑셀 파일을 가져오는 중입니다...', 'info');
      const parsed = await parseExcelFile(file);
      
      if (parsed && parsed.length > 0) {
        // 기존 전체 장부 데이터와 합치거나 덮어쓰기 선택 가능 (여기서는 간편하게 병합 처리)
        // 엑셀 행 ID 중복 배제 및 날짜순 정렬 후 잔고 자동 산출
        const merged = [...transactions, ...parsed].reduce((acc, current) => {
          const x = acc.find(item => item.date === current.date && item.description === current.description && item.amount === current.amount);
          if (!x) {
            return acc.concat([current]);
          } else {
            return acc;
          }
        }, []);
        
        updateTransactionsList(merged);
        showAlert(`성공적으로 엑셀 장부를 동기화했습니다! (${parsed.length}건 로드)`, 'success');
        
        // 폭죽 효과 트리거
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      } else {
        showAlert('엑셀 파일에 유효한 지출 내역이 없습니다.', 'warning');
      }
    } catch (err) {
      console.error(err);
      showAlert(`엑셀 가져오기 실패: ${err.message}`, 'danger');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 엑셀 장부 다운로드 내보내기
  const handleExcelExport = () => {
    try {
      exportToExcel(transactions, `교육팀_팀빌딩비_지출장부_${selectedYear}년_${selectedMonth}월.xlsx`);
      showAlert('최신 지출 장부가 엑셀로 저장되었습니다.', 'success');
    } catch (err) {
      showAlert(`엑셀 내보내기 실패: ${err.message}`, 'danger');
    }
  };

  // 장부 모달 다이얼로그 제어
  const openModal = (mode, tx = null, { copyFrom = null } = {}) => {
    setModalMode(mode);
    if (mode === 'edit' && tx) {
      setCurrentTx({ ...normalizeTransaction(tx, categories) });
    } else if (copyFrom) {
      const draft = cloneLedgerTransaction(copyFrom, selectedYear, selectedMonth);
      setCurrentTx({
        ...normalizeTransaction(draft, categories),
        id: '',
        extraData: sanitizeExtraData(draft.extraData),
      });
    } else {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      setCurrentTx({
        id: '',
        date: todayStr,
        category: loadUsageCategories()[0]?.label || '기타',
        description: '',
        amount: 0,
        balance: 0,
        paymentMethod: '법인카드',
        attendees: DEFAULT_ATTENDEES,
        extraData: { '영수증번호': '', '비고': '' }
      });
    }
    setIsModalOpen(true);
  };

  const handleDuplicateTx = (tx) => {
    openModal('add', null, { copyFrom: tx });
    showAlert('내용을 복사했습니다. 날짜·금액 확인 후 저장하세요.', 'info', 3500);
  };

  const handleCopyPreviousMonth = () => {
    const prev = getPreviousMonth(selectedYear, selectedMonth);
    const prevLabel = `${prev.year}년 ${parseInt(prev.month, 10)}월`;
    const targetLabel = `${selectedYear}년 ${parseInt(selectedMonth, 10)}월`;

    const prevMonthTxs = transactions.filter((t) => {
      const [y, m] = t.date.split('-');
      return y === prev.year && m === prev.month;
    });

    if (prevMonthTxs.length === 0) {
      showAlert(`${prevLabel}에 복사할 지출이 없습니다.`, 'warning');
      return;
    }

    const existing = new Set(
      transactions
        .filter((t) => t.date.startsWith(`${selectedYear}-${selectedMonth}`))
        .map(transactionDedupeKey)
    );

    const copies = [];
    prevMonthTxs.forEach((tx) => {
      const copy = cloneLedgerTransaction(tx, selectedYear, selectedMonth);
      const key = transactionDedupeKey(copy);
      if (existing.has(key)) return;
      copies.push(copy);
      existing.add(key);
    });

    if (copies.length === 0) {
      showAlert(`${targetLabel}에 이미 같은 내역이 모두 있습니다.`, 'info');
      return;
    }

    const skipped = prevMonthTxs.length - copies.length;
    const skipNote = skipped > 0 ? ` (동일 ${skipped}건은 건너뜀)` : '';
    if (
      !window.confirm(
        `${prevLabel} ${prevMonthTxs.length}건 중 ${copies.length}건을 ${targetLabel}로 복사할까요?${skipNote}\n날짜는 일(day) 기준으로 맞춥니다.`
      )
    ) {
      return;
    }

    updateTransactionsList([...transactions, ...copies]);
    notifyLedgerChanged(`${copies.length}건을 전월에서 복사했습니다.`);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  // 지출 장부 폼 제출
  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!currentTx.date || !currentTx.description || currentTx.amount <= 0) {
      showAlert('날짜, 상세 내역 및 올바른 지출 금액을 입력해 주세요.', 'warning');
      return;
    }

    const payload = normalizeTransaction(
      {
        ...currentTx,
        extraData: sanitizeExtraData(currentTx.extraData),
      },
      categories
    );

    if (modalMode === 'add') {
      const newTx = {
        ...payload,
        id: `tx-${Date.now()}`
      };
      updateTransactionsList([...transactions, newTx]);
      const [y, m] = newTx.date.split('-');
      if (y !== selectedYear || m !== selectedMonth) {
        setSelectedYear(y);
        setSelectedMonth(m);
      }
      notifyLedgerChanged('새 지출이 작성 장부에 기록되었습니다.');
    } else {
      const updated = transactions.map(t => t.id === payload.id ? payload : t);
      updateTransactionsList(updated);
      notifyLedgerChanged('지출 내역이 수정되었습니다.');
    }
    closeModal();
  };

  // 지출 내역 제거
  const handleDeleteTx = (id, desc) => {
    if (window.confirm(`"${desc}" 지출 내역을 장부에서 영구 삭제하시겠습니까?`)) {
      removeTransactionsByIds([id], '지출이 삭제되고 잔고가 재계산되었습니다.');
    }
  };

  const handleDeleteSelected = () => {
    if (selectedCount === 0) return;
    if (
      !window.confirm(
        `선택한 ${selectedCount}건의 지출 내역을 삭제할까요?\n삭제 후에는 되돌릴 수 없습니다.`
      )
    ) {
      return;
    }
    removeTransactionsByIds(selectedTxIds, `${selectedCount}건이 삭제되었습니다.`);
    exitBulkDeleteMode();
  };

  const handleDeleteAllVisible = () => {
    const ids = filteredTransactions.map((t) => t.id);
    if (ids.length === 0) return;
    const scope = hasExtraTableFilter
      ? `현재 필터·검색에 보이는 ${ids.length}건`
      : `${selectedYear}년 ${parseInt(selectedMonth, 10)}월 ${ids.length}건`;
    if (
      !window.confirm(
        `${scope}을 모두 삭제할까요?\n다른 달·필터에 숨겨진 내역은 삭제되지 않습니다.\n삭제 후에는 되돌릴 수 없습니다.`
      )
    ) {
      return;
    }
    removeTransactionsByIds(ids, `${ids.length}건이 삭제되었습니다.`);
    exitBulkDeleteMode();
  };

  // 동적 ExtraData 수정 제어
  const handleExtraDataChange = (key, val) => {
    setCurrentTx({
      ...currentTx,
      extraData: {
        ...currentTx.extraData,
        [key]: val
      }
    });
  };

  // 업로드된 엑셀에 존재할 수 있는 추가 헤더 열 목록 추출
  const getExtraKeys = () => {
    const keys = new Set(['영수증번호', '비고']);
    currentMonthTxs.forEach((t) => {
      if (!t.extraData || typeof t.extraData !== 'object') return;
      Object.keys(t.extraData).forEach((k) => {
        if (k && k !== 'undefined') keys.add(k);
      });
    });
    return Array.from(keys);
  };

  const extraKeys = getExtraKeys();

  // 지출 카테고리 분포 집계 (순수 CSS 도넛/막대용)
  const getCategoryStats = () => {
    const stats = Object.fromEntries(categories.map((c) => [c.label, 0]));
    let total = 0;

    currentMonthTxs.forEach((t) => {
      const cat = stats[t.category] !== undefined ? t.category : '기타';
      stats[cat] += t.amount;
      total += t.amount;
    });

    return Object.entries(stats).map(([cat, amt]) => ({
      name: cat,
      amount: amt,
      percent: total > 0 ? Math.round((amt / total) * 100) : 0
    })).filter(item => item.amount > 0);
  };

  const categoryStats = getCategoryStats();

  const publishedLabel = formatPublishedAt(snapshot?.publishedAt);

  return (
    <>
      <AppShell
        activeModule={displayModule}
        onModuleChange={setModule}
        navLabels={navLabels}
        navDefaults={navDefaults}
        onNavLabelSave={onNavLabelSave}
        onNavLabelsReset={onNavLabelsReset}
        isViewer={isViewer}
        viewerMenuVisibility={activeViewerMenuVisibility}
        onOpenViewerMenuSettings={() => setViewerMenuSettingsOpen(true)}
        teamAccess={isViewer ? null : teamAccess}
        sidebarFooter={
          ledgerReadOnly && displayModule === 'ledger' ? (
            <UsageStandardsPanel categories={categories} variant="sidebar" />
          ) : null
        }
      >
      {displayModule === 'docs' ? (
        <ReferenceDocsPage />
      ) : displayModule === 'academizer' && !isViewer ? (
        <AcademizerEmbedPage />
      ) : displayModule === 'cloud-chatbot' && !isViewer ? (
        <CloudChatbotEmbedPage />
      ) : displayModule === 'lunch' ? (
        <LunchPickPage />
      ) : displayModule === 'idea-bank' ? (
        <IdeaBankPage readOnly={isViewer} />
      ) : isKpiRelatedModule(displayModule) &&
        (!isViewer || displayModule === 'kpi-approve' || displayModule === 'kpi-report') ? (
        <JournalProvider readOnly={isViewer && displayModule !== 'kpi-approve'} autoSyncCloud={false}>
          {displayModule === 'journal' && <WeeklyJournalPage readOnly={false} />}
          {displayModule === 'competency' && <CompetencyPage />}
          {displayModule === 'kpi' && <TeamKpiPage />}
          {displayModule === 'kpi-approve' && (
            <KpiApprovePage readOnly={isViewer && displayModule !== 'kpi-approve'} />
          )}
          {displayModule === 'kpi-report' && <KpiReportPage />}
        </JournalProvider>
      ) : (
      <>
      <main className={`main-content${ledgerReadOnly ? ' main-content--ledger-readonly' : ''}`}>

        {ledgerReadOnly && loading && <LoadingScreen inline />}

        {ledgerReadOnly && snapshotEmpty && !loading && (
          <div
            className="custom-alert"
            style={{
              marginBottom: '1rem',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              borderLeft: '4px solid #3b82f6',
            }}
          >
            <AlertCircle size={18} style={{ color: '#60a5fa' }} />
            <div className="custom-alert-content">
              <h4 style={{ color: '#93c5fd' }}>{EMPTY_LEDGER_SNAPSHOT_TITLE}</h4>
              <p style={{ fontSize: '0.85rem' }}>{EMPTY_LEDGER_SNAPSHOT_DETAIL}</p>
            </div>
          </div>
        )}

        {ledgerReadOnly && snapshotWarning && !loading && (
          <div
            className="custom-alert"
            style={{
              marginBottom: '1rem',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              borderLeft: '4px solid #f59e0b',
            }}
          >
            <AlertCircle size={18} style={{ color: '#f59e0b' }} />
            <div className="custom-alert-content">
              <h4 style={{ color: '#fcd34d' }}>장부 cloud 조회 제한</h4>
              <p style={{ fontSize: '0.85rem' }}>{snapshotWarning}</p>
            </div>
          </div>
        )}

        {ledgerReadOnly && error && !loading && (
          <div
            className="custom-alert"
            style={{
              marginBottom: '1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderLeft: '4px solid #ef4444',
            }}
          >
            <AlertCircle size={18} style={{ color: '#ef4444' }} />
            <div className="custom-alert-content">
              <h4 style={{ color: '#fca5a5' }}>장부 snapshot을 불러오지 못했습니다</h4>
              <p style={{ fontSize: '0.85rem' }}>{error}</p>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: '0.75rem' }}
                onClick={() => reload({ force: true })}
                disabled={refreshing || reloadBlockedByCooldown}
              >
                <RefreshCw size={16} />
                {refreshing ? '불러오는 중…' : '다시 불러오기'}
              </button>
            </div>
          </div>
        )}

        {canEditLedgerNow && livePublishBlocked && (
          <div
            className="custom-alert"
            style={{
              marginBottom: '1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderLeft: '4px solid #ef4444',
            }}
          >
            <AlertCircle size={18} style={{ color: '#ef4444' }} />
            <div className="custom-alert-content">
              <h4 style={{ color: '#fca5a5' }}>실시간 조회 반영이 꺼져 있습니다</h4>
              <p style={{ fontSize: '0.85rem' }}>
                {livePublishBlockReason === 'quota-exceeded' ? (
                  <>
                    Vercel Blob 저장 용량(1GB)이 가득 차 조회 URL에 저장되지 않습니다. 대시보드 →{' '}
                    <strong>okestro-edu-team-tms</strong> → Storage → Blob에서 오래된{' '}
                    <code>ledger/live-</code> 파일을 삭제한 뒤 「지금 조회에 반영」을 다시 누르세요.
                    (작성 내용은 이 브라우저에만 있습니다.)
                  </>
                ) : (
                  <>
                    Vercel 대시보드 → 프로젝트 <strong>okestro-edu-team-tms</strong> → Storage →{' '}
                    <strong>Blob 연결</strong> 후 재배포하세요. 연결 전에는 「지금 조회에 반영」으로 JSON
                    백업·수동 배포가 필요합니다.
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {canEditLedgerNow && !livePublishBlocked && autoPublish.liveReady && (
          <div
            className="custom-alert"
            style={{
              marginBottom: '1rem',
              backgroundColor: 'var(--color-success-bg)',
              border: '1px solid var(--color-success-bg)',
              borderLeft: '4px solid var(--primary)',
            }}
          >
            <CheckCircle size={18} style={{ color: 'var(--primary)' }} />
            <div className="custom-alert-content">
              <h4 style={{ color: '#6ee7b7' }}>조회 반영 가능</h4>
              <p style={{ fontSize: '0.85rem' }}>
                작성 내용은 「지금 조회에 반영」을 눌러야 조회 URL에 올라갑니다.
                {autoPublish.publishing ? ' (반영 중…)' : ''}
                {autoPublish.lastPublishedAt &&
                  ` 마지막 반영: ${formatPublishedAt(autoPublish.lastPublishedAt)}`}
              </p>
            </div>
          </div>
        )}

        {canEditLedgerNow && !autoPublish.liveReady && unpublishedToView.length > 0 && (
          <div
            className="custom-alert"
            style={{
              marginBottom: '1rem',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              borderLeft: '4px solid #f59e0b',
            }}
          >
            <AlertCircle size={18} style={{ color: '#f59e0b' }} />
            <div className="custom-alert-content">
              <h4 style={{ color: '#fcd34d' }}>조회 페이지에 아직 없는 지출 {unpublishedToView.length}건</h4>
              <p style={{ fontSize: '0.85rem' }}>
                <strong>「지금 조회에 반영」</strong>을 눌러 서버에 올려야 조회 URL에 보입니다.
                {livePublishBlockReason === 'quota-exceeded' ? (
                  <>
                    {' '}
                    지금은 <strong>Vercel Blob 용량(1GB) 초과</strong>로 반영이 막혀 있습니다. Storage에서
                    Blob을 비운 뒤 다시 누르세요.
                  </>
                ) : (
                  <> 「지금 조회에 반영」으로 수동 업로드하세요.</>
                )}
              </p>
            </div>
          </div>
        )}

        {/* 알림 배너 */}
        {alert.show && (
          <div className="custom-alert" style={{ 
            backgroundColor: 'rgba(19, 27, 46, 0.8)',
            border: '1px solid var(--color-success-bg)',
            borderLeft: `4px solid var(--color-${alert.type === 'danger' ? 'danger' : alert.type === 'success' ? 'success' : 'info'})` 
          }}>
            <AlertCircle className="custom-alert-icon" size={18} style={{ color: alert.type === 'success' ? 'var(--primary)' : 'var(--primary)' }} />
            <div className="custom-alert-content">
              <h4 style={{ color: 'white' }}>장부 알림</h4>
              <p>{alert.message}</p>
            </div>
          </div>
        )}

        {/* 상단 헤더 */}
        <header className="content-header">
          <div className="header-title-area">
            <h1>교육팀 팀 빌딩비 장부</h1>
            <p>
              {ledgerReadOnly
                ? isMemberLedger
                  ? '구성원 장부는 조회 전용입니다. 거래 추가·수정·삭제는 팀장 화면에서만 가능합니다.'
                  : '교육팀 팀 빌딩 지출·잔액을 조회합니다. (작성·수정은 팀장만 가능)'
                : '매월 150,000원씩 배정되는 교육팀의 팀 빌딩 지출 및 잔액 흐름을 꼼꼼하게 관리합니다.'}
            </p>
            {isMemberLedger && !isViewer && (
              <p style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                조회 전용 화면입니다. 북마크 URL은{' '}
                <code>?mode=view&amp;module=ledger&amp;member={teamAccess.scopedMember}</code> 형식을 권장합니다.
              </p>
            )}
            {publishedLabel && (
              <p style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: 'var(--accent)' }}>
                <Eye size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {ledgerReadOnly ? '공개 기준' : '조회 화면 기준'}: {publishedLabel}
                {isViewer && (
                  <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>
                    · 「{LEDGER_SNAPSHOT_REFRESH_LABEL}」으로 최신 조회 데이터 불러오기
                  </span>
                )}
                {!ledgerReadOnly && autoPublish.liveReady && (
                  <span style={{ marginLeft: 8, color: '#6ee7b7' }}>· 조회 반영 가능</span>
                )}
                {!ledgerReadOnly && syncStatus === 'local-ahead' && !autoPublish.liveReady && (
                  <span style={{ marginLeft: 8, color: '#f59e0b' }}>· 작성본이 더 최신 → 「지금 조회에 반영」</span>
                )}
                {!ledgerReadOnly && syncStatus === 'remote-ahead' && (
                  <span style={{ marginLeft: 8, color: '#f59e0b' }}>· 조회가 더 최신 → 「조회 데이터 맞추기」</span>
                )}
              </p>
            )}
          </div>
          
          <div className="header-action-area">
            {ledgerReadOnly ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => reload({ force: true })}
                  disabled={refreshing || reloadBlockedByCooldown}
                  title={LEDGER_SNAPSHOT_REFRESH_TITLE}
                  aria-label={LEDGER_SNAPSHOT_REFRESH_LABEL}
                >
                  <RefreshCw size={16} />
                  {refreshing ? '불러오는 중…' : LEDGER_SNAPSHOT_REFRESH_LABEL}
                </button>
              </>
            ) : (
            <>
            {showDevProdLedgerImport && (
              <button
                type="button"
                className="btn btn-import-shared"
                onClick={handleImportProdLedger}
                disabled={importingProdLedger}
                aria-label="운영 장부 가져오기 (개발 전용)"
                {...uiTooltip(
                  '운영 장부 데이터를 이 개발환경 편집본으로 가져옵니다. 운영 저장소에는 쓰지 않습니다. (개발 전용)',
                  undefined,
                  { wrap: true }
                )}
              >
                <Import size={16} />
                {importingProdLedger ? '가져오는 중…' : '운영 장부 가져오기'}
                <span className="btn-dev-chip">개발</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handlePullFromPublished}
              disabled={!snapshot?.transactions?.length}
              title="조회 URL과 동일한 ledger-snapshot.json 을 작성 장부에 반영"
            >
              <RefreshCw size={16} />
              조회 데이터 맞추기
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDownloadLedgerBackup}
              title="조회 반영과 별도로 현재 작성 장부를 ledger-snapshot.json으로 백업합니다"
            >
              <Download size={16} />
              장부 JSON 백업 다운로드
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ backgroundColor: 'var(--primary)', boxShadow: '0 4px 14px rgba(14, 165, 233, 0.25)' }}
              onClick={handlePublishForTeam}
              disabled={autoPublish.publishing || ledgerPublishBlocked}
              title={ledgerPublishBlockTooltip}
            >
              <Share2 size={16} />
              {autoPublish.publishing ? '반영 중…' : '지금 조회에 반영'}
            </button>

            {/* 엑셀 가져오기 */}
            <div className="file-upload-wrapper">
              <button className="btn btn-secondary" style={{ borderColor: 'var(--color-success-bg)' }}>
                <Upload size={16} />
                엑셀 불러오기
              </button>
              <input 
                type="file" 
                ref={fileInputRef}
                accept=".xlsx, .xls, .csv" 
                className="file-upload-input" 
                onChange={handleExcelUpload} 
              />
            </div>

            {canExportLedgerExcel ? (
              <button
                type="button"
                className="btn btn-primary"
                style={{ backgroundColor: 'var(--primary)', boxShadow: '0 4px 14px var(--color-success-bg)' }}
                onClick={handleExcelExport}
              >
                <Download size={16} />
                엑셀로 내보내기
              </button>
            ) : null}
            </>
            )}
          </div>
        </header>

        {/* 월별 선택 및 통계 카드 요약 */}
        <section style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', backgroundColor: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>조회 기간 선택:</span>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select 
              className="select-field" 
              style={{ minWidth: '100px', padding: '0.5rem' }} 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {ledgerYearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>

            <select 
              className="select-field" 
              style={{ minWidth: '90px', padding: '0.5rem' }} 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <Sparkles size={14} style={{ color: 'var(--primary)' }} />
            <span>해당 월의 데이터로 통계 및 테이블이 즉각 조정됩니다.</span>
          </div>
        </section>

        {/* 3. 예산 및 지출 잔액 카드 현황 */}
        <section className="stats-grid" style={{ marginBottom: '2rem' }}>
          
          <div className="stat-card" style={{ borderColor: 'rgba(14, 165, 233, 0.15)' }}>
            <div className="stat-card-header">
              <span>월 할당 예산</span>
              <div className="stat-icon-box" style={{ color: 'var(--primary)', backgroundColor: 'rgba(14, 165, 233, 0.08)' }}>
                <DollarSign size={16} />
              </div>
            </div>
            <div className="stat-card-value">{monthlyBudget.toLocaleString()}원</div>
            <div className="stat-card-footer">
              교육팀 인당 정산 기본 정책
            </div>
          </div>

          <div className="stat-card" style={{ borderColor: 'rgba(239, 68, 68, 0.15)' }}>
            <div className="stat-card-header">
              <span>이번 달 누적 지출액</span>
              <div className="stat-icon-box" style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.08)' }}>
                <TrendingUp size={16} />
              </div>
            </div>
            <div className="stat-card-value" style={{ color: '#ef4444' }}>{totalSpent.toLocaleString()}원</div>
            <div className="stat-card-footer">
              예산 소진 비율: <span className="trend-down" style={{ color: '#ef4444' }}>{usagePercent}%</span>
            </div>
          </div>

          <div className="stat-card" style={{ borderColor: remainingBalance >= 0 ? 'var(--color-success-bg)' : 'rgba(239, 68, 68, 0.3)' }}>
            <div className="stat-card-header">
              <span>남은 예산 잔액</span>
              <div className="stat-icon-box" style={{ color: remainingBalance >= 0 ? 'var(--color-success)' : 'var(--color-danger)', backgroundColor: remainingBalance >= 0 ? 'var(--color-success-bg)' : 'var(--color-danger-bg)' }}>
                <CheckCircle size={16} />
              </div>
            </div>
            <div className="stat-card-value" style={{ color: remainingBalance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {remainingBalance.toLocaleString()}원
            </div>
            <div className="stat-card-footer">
              {remainingBalance >= 0 ? (
                <span>
                  {ledgerDetailsCollapsible && !viewerDetailsOpen
                    ? '상세보기에서 지출 내역·분석 확인'
                    : '사용 가능 한도 여유 있음'}
                </span>
              ) : (
                <span style={{ color: '#ef4444', fontWeight: 600 }}>⚠️ 예산 초과 상태!</span>
              )}
            </div>
            {ledgerDetailsCollapsible && (
              <button
                type="button"
                className="stat-card-detail-btn"
                onClick={toggleViewerDetails}
                aria-expanded={viewerDetailsOpen}
              >
                {viewerDetailsOpen ? (
                  <>
                    <ChevronUp size={14} />
                    상세 접기
                  </>
                ) : (
                  <>
                    <Eye size={14} />
                    상세보기
                  </>
                )}
              </button>
            )}
          </div>

          {/* 지출 소진율 프로그레스 바 */}
          <div className="stat-card stat-card--budget-progress">
            <div className="stat-card-header" style={{ marginBottom: '0.75rem' }}>
              <span>예산 집행 진행도</span>
            </div>
            <div className="budget-progress-row">
              <div className="budget-progress-track" aria-hidden>
                <div
                  className="budget-progress-fill"
                  style={{
                    width: `${spentPercent}%`,
                    background:
                      usagePercent > 100
                        ? '#ef4444'
                        : 'linear-gradient(to right, var(--primary), var(--primary))',
                  }}
                />
              </div>
              <span
                className={`budget-progress-pct${usagePercent > 100 ? ' is-over' : ''}`}
                aria-label={`사용률 ${usagePercent}%`}
              >
                {usagePercent}%
              </span>
            </div>
            <div className="stat-card-footer" style={{ marginTop: '0.5rem' }}>
              적정 집행 권장 비율: 월말 기준 90~100%
            </div>
          </div>
        </section>

        {(!ledgerReadOnly || showLedgerDetails) && (
        <div
          ref={ledgerReadOnly ? viewerDetailsRef : null}
          className={ledgerReadOnly ? 'viewer-ledger-details' : undefined}
        >
        {/* 4. 지출 차트 및 지출 내역 상세 분석 */}
        <section className="dashboard-middle-section" style={{ marginBottom: '2rem' }}>
          
          {/* 사용 유형별 지출 비율 (막대 시각화) */}
          <div className="chart-card">
            <div className="card-title">
              <div>
                사용 유형별 정산비 분석
                <p className="card-subtitle">선택된 달({selectedMonth}월)의 항목별 지출 규모와 점유율을 시각화합니다.</p>
              </div>
              <PieChart size={16} style={{ color: 'var(--primary)' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              {categoryStats.length > 0 ? (
                categoryStats.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ fontWeight: 600 }}>{item.name}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {item.amount.toLocaleString()}원 ({item.percent}%)
                      </span>
                    </div>
                    <div style={{ height: '6px', width: '100%', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${item.percent}%`, 
                        backgroundColor: getCategoryStyle(item.name, categories).color,
                        borderRadius: '4px'
                      }}></div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0', fontSize: '0.85rem' }}>
                  해당 월에 기록된 지출 거래가 없어 분석 데이터를 표시할 수 없습니다.
                </div>
              )}
            </div>
          </div>

          {/* 지출 관련 안내 사항 */}
          <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div className="card-title">
              팀 빌딩비 운영 가이드
            </div>
            <div className="activity-list" style={{ gap: '0.75rem' }}>
              <div className="activity-item">
                <div className="activity-avatar" style={{ color: 'var(--primary)', backgroundColor: 'var(--color-success-bg)' }}>법</div>
                <div className="activity-info">
                  <h5>기본 결제 방식</h5>
                  <p>원칙적으로 법인카드로 결제하고 영수증 번호를 입력해 정산합니다.</p>
                </div>
              </div>
              <div className="activity-item">
                <div className="activity-avatar" style={{ color: 'var(--primary)', backgroundColor: 'rgba(14, 165, 233, 0.08)' }}>참</div>
                <div className="activity-info">
                  <h5>참석자 조건 및 정산 한도</h5>
                  <p>팀 빌딩비 정산 시 최소 2인 이상 참석 및 명부 기입이 필수적입니다.</p>
                </div>
              </div>
              <div className="activity-item">
                <div className="activity-avatar" style={{ color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.08)' }}>이</div>
                <div className="activity-info">
                  <h5>이월 정책 금지</h5>
                  <p>당월 미집행된 잔액 15만 원 한도는 다음 달로 이월되지 않고 소멸됩니다.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {canEditLedgerNow && (
          <section className="ledger-usage-standards-wrap" aria-label="사용 유형 기준">
            <UsageStandardsPanel
              categories={categories}
              variant="main"
              showManage
              onManage={() => setIsCategoryManageOpen(true)}
            />
          </section>
        )}

        {/* 5. 지출 장부 목록 테이블 영역 */}
        <section className="table-container-card">
          {canEditLedgerNow && (
            <div ref={ledgerToolbarSentinelRef} className="ledger-toolbar-sentinel" aria-hidden="true" />
          )}
          {canEditLedgerNow && ledgerToolbarPinned && ledgerToolbarHeight > 0 && (
            <div style={{ height: ledgerToolbarHeight, flexShrink: 0 }} aria-hidden="true" />
          )}
          <div
            ref={canEditLedgerNow ? ledgerToolbarRef : null}
            className={`table-controls${canEditLedgerNow ? ' ledger-table-toolbar' : ''}${ledgerToolbarPinned ? ' is-pinned' : ''}`}
          >
            
            {/* 검색 필드 */}
            <div className="search-input-wrapper">
              <Search size={16} />
              <input 
                type="text" 
                placeholder="사용 내역, 참석자, 결제 수단 검색..." 
                className="input-field" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* 필터 세트 */}
            <div className="filter-group">
              <select 
                className="select-field" 
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="All">모든 사용유형</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.label}>{c.label}</option>
                ))}
              </select>

              <select 
                className="select-field" 
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
              >
                <option value="All">모든 결제수단</option>
                <option value="법인카드">법인카드</option>
                <option value="개인카드(정산)">개인카드(정산)</option>
                <option value="현금">현금</option>
              </select>

              {canEditLedgerNow && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCopyPreviousMonth}
                    title="전월 지출을 이번 달 날짜로 복사"
                  >
                    <Copy size={16} />
                    전월 내역 복사
                  </button>
                  <button className="btn btn-primary" onClick={() => openModal('add')}>
                    <Plus size={16} />
                    지출 내역 기록
                  </button>
                </>
              )}
            </div>
          </div>

          {canEditLedgerNow && filteredTransactions.length > 0 && (
            <div className={`ledger-bulk-actions${bulkDeleteMode ? ' ledger-bulk-actions--active' : ''}`}>
              <span className="ledger-bulk-actions__hint">
                {bulkDeleteMode
                  ? selectedCount > 0
                    ? `${selectedCount}건 선택 · 체크하거나 행의 삭제를 누르세요`
                    : '삭제할 항목을 선택하거나 각 행의 삭제 버튼을 누르세요'
                  : `목록 ${filteredTransactions.length}건`}
              </span>
              <div className="ledger-bulk-actions__buttons">
                {bulkDeleteMode ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary ledger-bulk-btn-danger"
                      disabled={selectedCount === 0}
                      onClick={handleDeleteSelected}
                    >
                      <Trash2 size={16} />
                      선택한 {selectedCount}건 삭제
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={exitBulkDeleteMode}>
                      <X size={16} />
                      취소
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary ledger-bulk-btn-danger-outline"
                      onClick={() => setBulkDeleteMode(true)}
                    >
                      <Trash2 size={16} />
                      선택 삭제
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary ledger-bulk-btn-danger-outline"
                      onClick={handleDeleteAllVisible}
                    >
                      <Trash2 size={16} />
                      {visibleBulkDeleteLabel}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 지출 리스트 테이블 */}
          {filteredTransactions.length > 0 ? (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    {canEditLedgerNow && bulkDeleteMode && (
                      <th className="ledger-select-col">
                        <input
                          type="checkbox"
                          className="ledger-row-checkbox"
                          checked={allVisibleSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someVisibleSelected;
                          }}
                          onChange={toggleSelectAllVisible}
                          aria-label="목록 전체 선택"
                          title="현재 목록 전체 선택"
                        />
                      </th>
                    )}
                    <th>날짜</th>
                    <th>사용 유형</th>
                    <th>사용 내역 (상세 내용)</th>
                    <th>결제 수단</th>
                    <th>참석자 명단</th>
                    <th style={{ textAlign: 'right' }}>지출 금액</th>
                    <th style={{ textAlign: 'right' }}>현재 잔액</th>
                    
                    {/* 동적 엑셀 헤더 컬럼 */}
                    {extraKeys.map((key, idx) => (
                      <th key={idx}>{key}</th>
                    ))}

                    {canEditLedgerNow && (
                      <th style={{ textAlign: 'center' }}>{bulkDeleteMode ? '삭제' : '수정'}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className={
                        bulkDeleteMode && selectedTxIds.includes(tx.id) ? 'ledger-row-selected' : undefined
                      }
                    >
                      {canEditLedgerNow && bulkDeleteMode && (
                        <td className="ledger-select-col">
                          <input
                            type="checkbox"
                            className="ledger-row-checkbox"
                            checked={selectedTxIds.includes(tx.id)}
                            onChange={() => toggleTxSelection(tx.id)}
                            aria-label={`${tx.date} ${tx.description} 선택`}
                          />
                        </td>
                      )}
                      {/* 날짜 */}
                      <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{tx.date}</td>

                      {/* 사용 유형 배지 */}
                      <td>
                        <CategoryBadge label={tx.category} categories={categories} />
                      </td>

                      {/* 상세 내용 */}
                      <td>
                        <div style={{ fontWeight: 500, color: 'white' }}>{tx.description}</div>
                      </td>

                      {/* 결제 수단 */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <CreditCard size={12} style={{ color: 'var(--primary)' }} />
                          {tx.paymentMethod}
                        </div>
                      </td>

                      {/* 참석자 명단 */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.attendees}>
                          <UserCheck size={12} style={{ color: 'var(--primary)' }} />
                          {normalizeAttendees(tx.attendees)}
                        </div>
                      </td>

                      {/* 지출 금액 */}
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>
                        -{tx.amount.toLocaleString()}원
                      </td>

                      {/* 잔고 실시간 동기화 출력 */}
                      <td style={{ 
                        textAlign: 'right', 
                        fontWeight: 700, 
                        color: tx.balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' 
                      }}>
                        {tx.balance.toLocaleString()}원
                      </td>

                      {/* 동적 엑셀 속성 셀 출력 */}
                      {extraKeys.map((key) => {
                        const val = tx.extraData?.[key];
                        const text = val == null || val === '' ? '—' : String(val);
                        return (
                          <td key={key} style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            {text}
                          </td>
                        );
                      })}

                      {canEditLedgerNow && (
                      <td>
                        {bulkDeleteMode ? (
                          <button
                            type="button"
                            className="btn btn-secondary ledger-row-delete-btn"
                            onClick={() => handleDeleteTx(tx.id, tx.description)}
                          >
                            <Trash2 size={14} />
                            삭제
                          </button>
                        ) : (
                          <div className="action-btn-group" style={{ justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="icon-btn"
                              title="이 내역 복사해서 새로 등록"
                              onClick={() => handleDuplicateTx(tx)}
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              title="장부 내역 수정"
                              onClick={() => openModal('edit', tx)}
                            >
                              <Edit2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon" style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--primary)' }}>
                <Calendar size={32} />
              </div>
              <h3>해당 월에 등록된 지출 내역이 없습니다</h3>
              <p>{ledgerReadOnly ? '다른 월을 선택해 보세요.' : '오른쪽 상단의 엑셀 불러오기를 하거나 신규 지출 내역을 직접 추가해 보세요.'}</p>
              {canEditLedgerNow && (
              <button
                className="btn btn-secondary"
                style={{ borderColor: 'var(--color-success-bg)' }}
                onClick={() => {
                  if (window.confirm('저장된 장부를 지우고 엑셀 기본 데이터(54건)로 되돌릴까요?')) {
                    resetToBundledData();
                    showAlert('엑셀 기본 데이터로 장부를 복원했습니다.', 'success');
                  }
                }}
              >
                엑셀 데이터 다시 불러오기
              </button>
              )}
            </div>
          )}
        </section>
        </div>
        )}

        {canEditLedgerNow && (
          <div className="ledger-fab-stack" role="group" aria-label="빠른 지출 입력">
            <button
              type="button"
              className="ledger-fab ledger-fab--card"
              onClick={() => setIsCardPasteOpen(true)}
              aria-label="카드 알림 붙여넣기"
              title="카카오톡 법인카드 알림 붙여넣기"
            >
              <MessageSquare size={20} />
              <span>카드 붙여넣기</span>
            </button>
            <button
              type="button"
              className="ledger-fab ledger-fab--primary"
              onClick={() => openModal('add')}
              aria-label="지출 내역 기록"
            >
              <Plus size={22} />
              <span>지출 기록</span>
            </button>
          </div>
        )}
      </main>

      {/* 6. 지출 내역 기록/수정 폼 모달 다이얼로그 */}
      {canEditLedgerNow && (
      <div className={`modal-overlay ${isModalOpen ? 'active' : ''}`}>
        <div className="modal-content" style={{ borderColor: 'var(--color-success-bg)' }}>
          <div className="modal-header">
            <h3>{modalMode === 'add' ? '새 지출 내역 등록' : '지출 상세 정보 수정'}</h3>
            <button className="modal-close" onClick={closeModal}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleFormSubmit}>
            <div className="form-grid">
              
              <div className="form-group">
                <label>지출 날짜</label>
                <input 
                  type="date" 
                  className="form-input" 
                  required
                  value={currentTx.date}
                  onChange={(e) => setCurrentTx({ ...currentTx, date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>사용 유형 (기준표)</label>
                <select 
                  className="form-input"
                  value={currentTx.category}
                  onChange={(e) => setCurrentTx({ ...currentTx, category: e.target.value })}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.label}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group form-group-full">
                <label>상세 사용 내역 (내용)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required
                  placeholder="예: CGV 영화 티켓 예매 정산"
                  value={currentTx.description}
                  onChange={(e) => setCurrentTx({ ...currentTx, description: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>결제 수단</label>
                <select 
                  className="form-input"
                  value={currentTx.paymentMethod}
                  onChange={(e) => setCurrentTx({ ...currentTx, paymentMethod: e.target.value })}
                >
                  <option value="법인카드">법인카드</option>
                  <option value="개인카드(정산)">개인카드(정산)</option>
                  <option value="현금">현금</option>
                </select>
              </div>

              <div className="form-group">
                <label>지출 금액 (원)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  required
                  placeholder="예: 45000"
                  value={currentTx.amount || ''}
                  onChange={(e) => setCurrentTx({ ...currentTx, amount: Number(e.target.value) })}
                />
              </div>

              <div className="form-group form-group-full">
                <label>참석자 명단 (쉼표로 구분)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder={`미입력 시 ${DEFAULT_ATTENDEES} (예: 김도현, 이지아)`}
                  value={currentTx.attendees}
                  onChange={(e) => setCurrentTx({ ...currentTx, attendees: e.target.value })}
                />
              </div>

              {/* 엑셀 파일 업로드 시 들어올 수 있는 동적 커스텀 항목 편집 */}
              <div className="form-group">
                <label>영수증 번호</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="영수증 번호 입력"
                  value={currentTx.extraData['영수증번호'] || ''}
                  onChange={(e) => handleExtraDataChange('영수증번호', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>비고</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="추가 전달 정보"
                  value={currentTx.extraData['비고'] || ''}
                  onChange={(e) => handleExtraDataChange('비고', e.target.value)}
                />
              </div>

            </div>

            <div className="modal-actions" style={{ borderTop: '1px solid var(--color-success-bg)' }}>
              <button type="button" className="btn btn-secondary" onClick={closeModal}>
                기록 취소
              </button>
              <button type="submit" className="btn btn-primary">
                장부에 쓰기
              </button>
            </div>
          </form>
        </div>
      </div>
      )}

      {canEditLedgerNow && (
      <>
      <CategoryManageModal
        isOpen={isCategoryManageOpen}
        onClose={() => setIsCategoryManageOpen(false)}
        categories={categories}
        onAdd={addCategory}
        onUpdate={updateCategory}
        onRemove={(id) => removeCategory(id, transactions)}
        onReset={() => {
          const defaults = resetToDefault();
          updateTransactionsList(transactions.map((t) => normalizeTransaction(t, defaults)));
        }}
        transactions={transactions}
      />

      <CardPasteModal
        isOpen={isCardPasteOpen}
        onClose={() => setIsCardPasteOpen(false)}
        categories={categories}
        defaultCategory={categories.find((c) => c.label === '기타')?.label || categories[0]?.label}
        onApply={handleCardPasteApply}
      />

      </>
      )}
      </>
      )}
      </AppShell>
      {!isViewer && teamAccess.isLeader && !teamAccess.isMemberScope && (
        <ViewerMenuSettingsModal
          isOpen={viewerMenuSettingsOpen}
          onClose={() => setViewerMenuSettingsOpen(false)}
          visibility={activeViewerMenuVisibility}
          navLabels={navLabels}
          onApply={handleApplyViewerMenuVisibility}
          onReset={handleResetViewerMenuVisibility}
        />
      )}
    </>
  );
}
