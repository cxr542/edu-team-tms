import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Import,
  Copy,
  MessageSquare,
  Download,
  Save,
  Send,
  Search,
  Sparkles,
  Target,
  Upload,
} from 'lucide-react';
import { resolveMemberCategories } from '../utils/journalMemberPrefs';
import { useJournal } from '../context/JournalProvider';
import { useJournalPeriod } from '../hooks/useJournalPeriod';
import {
  dateKey,
  getDayHoursInfo,
  FULL_LEAVE_MM,
  getDayAvailableMm,
  getTaskLoggedHours,
  getTaskMmAxis,
  getWeekCompletionStats,
  getWeeksInMonth,
  hoursToMm,
  getMmAxisSelectValue,
  recalcDayMmFromHours,
} from '../utils/journalMm';
import { countKpi2EffectTasks } from '../utils/computeTeamKpi';
import { formatPublishedAt } from '../utils/appMode';
import { getCloudHealthUserMessage } from '../utils/cloudHealth';
import {
  is2026PublicHoliday,
  resolveJournalDay,
  setPublicHolidayOverride,
} from '../utils/journalHoliday2026';
import { applyLeavePresetToDay, LEAVE_MEMO_TASK_RE, LEAVE_PRESET_BUTTONS } from '../utils/journalLeavePresets';
import { findWeekKeyForDayKey, resolveJournalScrollDayKey, scheduleScrollJournalDay } from '../utils/journalScroll';
import { mergeTaskFromEdit, taskFieldsFromEdit } from '../utils/journalTaskFields';
import { loadCollapsedWeekKeys, saveCollapsedWeekKeys } from '../utils/journalWeekVisibility';
import { KPI1_NAME, KPI2_NAME } from '../constants/kpiDisplayNames';
import {
  TEAM_KPI_MEMBERS,
  TEAM_LEADER_MEMBER_CODE,
  JOURNAL_LINKED_MEMBER_CODE,
  findKpiMember,
  formatKpiMemberLabel,
  formatKpiMemberRoleLine,
} from '../constants/kpiMembers';
import {
  getTaskSlotLabel,
  JOURNAL_TASK_SLOTS,
  normalizeTaskSlot,
  resolveTaskSlotField,
  sortTasksBySlot,
} from '../constants/journalTaskSlot';
import AppModuleLink from '../components/AppModuleLink';
import JournalWeekColumnTextarea from '../components/JournalWeekColumnTextarea';
import { uiTooltip } from '../utils/uiTooltip';
import { applyLeaderJournalMemberToUrl, canEditMemberJournal, useTeamAccess } from '../hooks/useTeamAccess';
import { URL_ACCESS_ADMIN } from '../constants/teamAccess';
import { JournalEditKpiPreview, TaskKpiBadge } from '../components/JournalKpiLinkagePanel';
import JournalCategoryLegend from '../components/JournalCategoryLegend';
import JournalMemberPrefsModal from '../components/JournalMemberPrefsModal';
import MemberKpiApprovalPanel, { useMemberKpiApprovalToolbarState } from '../components/MemberKpiApprovalPanel';
import MemberImproveProjectsDialog from '../components/MemberImproveProjectsDialog';
import { isEditorMode } from '../utils/appMode';
import {
  filterImproveProjectsForMember,
  filterImproveProjectsOwnedByMember,
  describeImproveProjectsShareImport,
  formatImproveProjectOwnerLine,
  IMPROVE_PROJECT_JOURNAL_SCOPE_NOTICE,
} from '../utils/improveProjectLink';
import { SHOW_BC_JOURNAL_TEAM_SHARE_UI } from '../constants/improveProjectSharingConfig';
import { IMPROVE_PROJECT_BLOB_SHARE_ENABLED } from '../constants/improveProjectsShare';
import { buildMemberJournalSavePayload } from '../utils/journalSnapshot';
import { fetchJournalSnapshot } from '../utils/journalSnapshot';
import { saveJournalSnapshotToSupabase } from '../utils/supabaseJournalSnapshot';
import {
  fetchTeamJournalSnapshotFromSupabase,
  getJournalSnapshotFromSupabase,
} from '../utils/supabaseJournalSnapshot';
import {
  SUPABASE_MANUAL_MIRROR_DISABLED_MESSAGE,
  SUPABASE_MANUAL_MIRROR_ENABLED,
} from '../constants/supabaseSync';
import {
  JOURNAL_BLOB_POST_DISABLED_MESSAGE,
  JOURNAL_BLOB_POST_ENABLED,
} from '../constants/journalBlobShare';
import { compareJournalSnapshots } from '../utils/journalStorageComparison';
import {
  JOURNAL_FRESHNESS_STATUS,
  classifyJournalFreshness,
  formatJournalFreshnessLabel,
  resolveLocalMemberUpdatedAt,
  resolveRemoteSnapshotUpdatedAt,
} from '../utils/journalSupabaseFreshness';
import { useJournalSupabaseFreshness } from '../hooks/useJournalSupabaseFreshness';
import JournalTaskTitleCombobox from '../components/JournalTaskTitleCombobox';
import { collectJournalTaskTitles } from '../utils/journalTaskTitleSuggestions';
import './WeeklyJournalPage.css';

const MEMBER_IMPROVE_PROJECT_CODES = new Set(['B', 'C']);
const SUPABASE_JOURNAL_SAVE_STATUS_LABEL = {
  idle: '',
  saving: ' · Supabase 저장 중',
  ok: ' · Supabase 저장 완료',
  disabled: ' · Supabase 미설정',
  error: ' · Supabase 저장 실패',
};

const SUPABASE_AUTO_MIRROR_STATUS_LABEL = {
  idle: '',
  queued: ' · Supabase 자동 미러 대기',
  saving: ' · Supabase 자동 미러 중',
  saved: ' · Supabase 자동 미러 완료',
  conflict: ' · Supabase 자동 미러 충돌 — 원격이 더 최신',
  error: ' · Supabase 자동 미러 실패',
};

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function formatSummaryPct(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Math.min(100, Number(value)).toFixed(1)}%`;
}

function formatDayLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${y}년 ${m}월 ${d}일 (${DAY_NAMES[dt.getDay()]})`;
}

function journalPullToastMessage(result) {
  if (!result.ok) {
    if (result.reason === 'no-remote') {
      return '팀 공유본을 불러오지 못했습니다. 공유 저장소가 비어 있거나 개발 서버에서는 public/journal-snapshot.json만 사용할 수 있습니다.';
    }
    return '팀 공유본을 가져오지 못했습니다';
  }
  const when = formatPublishedAt(result.publishedAt);
  const sourceLabel =
    result.source === 'supabase'
      ? 'Supabase'
      : result.source === 'blob'
        ? '클라우드'
        : result.source === 'static'
          ? '백업 파일'
          : '공유 저장소';
  if (!result.changed) {
    return when
      ? `가져온 공유본(${sourceLabel}, ${when})과 이 브라우저 내용이 같습니다`
      : '가져온 공유본과 이 브라우저 내용이 같습니다';
  }
  return when
    ? `팀 공유본을 병합했습니다 (${sourceLabel}, ${when})`
    : '팀 공유본을 이 브라우저에 병합했습니다';
}

const DEFAULT_ADD_DRAFT = { cat: 'edu', title: '', plan: 4, actual: 0, done: false, slot: '' };

function navigateToDayKey(dayKey, { year, month, setPeriod, setSelectedDayKey, scrollToDayRef, setScrollTick }) {
  const [y, m] = dayKey.split('-').map(Number);
  const monthIndex = m - 1;
  if (y !== year || monthIndex !== month) {
    setPeriod(y, monthIndex);
  }
  scrollToDayRef.current = dayKey;
  setScrollTick((t) => t + 1);
  setSelectedDayKey(dayKey);
}

function formatHoursPair(actual, plan) {
  const a = Number(actual) || 0;
  const p = Number(plan) || 0;
  if (a <= 0 && p <= 0) return null;
  if (p > 0) return `${a}/${p}h`;
  return `${a}h`;
}

function formatTaskHoursLine(task) {
  return formatHoursPair(task.actual, task.plan);
}

function formatDayHoursBadge(info) {
  const plan = info.planned > 0 ? info.planned : info.expected;
  const label = `${info.total}/${plan}h`;
  const title =
    info.planned > 0
      ? `실작업 ${info.total}h / 계획 ${info.planned}h (목표 ${info.expected}h)`
      : `실작업 ${info.total}h / 계획 없음 (일일 목표 ${info.expected}h)`;
  return { label, title };
}

function TaskMmPill({ task }) {
  const h = getTaskLoggedHours(task);
  if (h <= 0) return null;
  const axis = getTaskMmAxis(task);
  const label = axis === 'improve' ? '향상' : '업무';
  return (
    <span className={`task-mm-pill ${axis}`} title={`실작업 ${h}h ÷ 8`}>
      {label} {hoursToMm(h)}
    </span>
  );
}

function getTodayParts() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), key: dateKey(now.getFullYear(), now.getMonth(), now.getDate()) };
}

function formatJournalDayHeading(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${DAY_NAMES[dt.getDay()]}요일 업무일지`;
}

function describeFocusDayTasks(tasks) {
  const count = (tasks || []).length;
  if (count === 0) return '선택 날짜에 아직 항목 없음';
  return `선택 날짜에 항목 ${count}건`;
}

export default function WeeklyJournalPage({ readOnly = false }) {
  const journal = useJournal();
  const { year, month, setPeriod, changeMonth } = useJournalPeriod();
  const importInputRef = useRef(null);
  const viewOnlyImportInputRef = useRef(null);
  const journalMainRef = useRef(null);
  const scrollToDayRef = useRef(null);
  const pendingScrollToastRef = useRef(null);
  const teamAccess = useTeamAccess();
  const [memberCode, setMemberCode] = useState(teamAccess.defaultMemberCode);
  const selectedMember = useMemo(() => findKpiMember(memberCode) || TEAM_KPI_MEMBERS[0], [memberCode]);
  const journalReadOnly = readOnly || !canEditMemberJournal(teamAccess, memberCode);
  const viewingOtherMember =
    teamAccess.memberLocked && memberCode !== teamAccess.scopedMember;
  const canImportJournalBackup = teamAccess.isLeader || memberCode === TEAM_LEADER_MEMBER_CODE;
  const canImportViewOnlyJournalBackup = teamAccess.memberLocked && !readOnly;

  useEffect(() => {
    if (teamAccess.memberLocked) setMemberCode(teamAccess.scopedMember);
    else if (teamAccess.isLeader && teamAccess.scopedMember) {
      setMemberCode(teamAccess.scopedMember);
    }
  }, [teamAccess.memberLocked, teamAccess.scopedMember, teamAccess.isLeader]);
  const [selectedDayKey, setSelectedDayKey] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoTask, setMemoTask] = useState(null);
  const [memoText, setMemoText] = useState('');
  const [addDayKey, setAddDayKey] = useState(null);
  const [leaveDayKey, setLeaveDayKey] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargetDayKey, setCopyTargetDayKey] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTargetDayKey, setMoveTargetDayKey] = useState('');
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [collapsedWeeks, setCollapsedWeeks] = useState(() => loadCollapsedWeekKeys(year, month, memberCode));
  const [memberPrefsOpen, setMemberPrefsOpen] = useState(false);
  const [improveProjectsModalOpen, setImproveProjectsModalOpen] = useState(false);
  const [kpiApprovalModalOpen, setKpiApprovalModalOpen] = useState(false);
  const [shareImportChoiceOpen, setShareImportChoiceOpen] = useState(false);
  const [supabaseJournalSaveStatus, setSupabaseJournalSaveStatus] = useState('idle');
  const [supabaseJournalPullStatus, setSupabaseJournalPullStatus] = useState('idle');
  const [storageComparisonStatus, setStorageComparisonStatus] = useState('idle');
  const [storageComparison, setStorageComparison] = useState(null);

  const memberCategoryView = useMemo(
    () => resolveMemberCategories(journal.memberJournals?.[memberCode]?.prefs),
    [journal.memberJournals, memberCode]
  );
  const isImproveProjectMember = MEMBER_IMPROVE_PROJECT_CODES.has(memberCode);
  const showImproveProjectPanel = !journalReadOnly && (teamAccess.isMemberScope || isImproveProjectMember);
  const isMemberJournalScope = teamAccess.isMemberScope;
  const showMemberKpiApproval =
    isMemberJournalScope &&
    memberCode === teamAccess.scopedMember &&
    !journalReadOnly &&
    isEditorMode();
  const showJournalTeamShareControls =
    !journalReadOnly && (SHOW_BC_JOURNAL_TEAM_SHARE_UI || !isImproveProjectMember);
  const canSaveJournalTeamShare =
    !teamAccess.isLeader &&
    showJournalTeamShareControls;
  const showMemberTeamSharePull =
    SHOW_BC_JOURNAL_TEAM_SHARE_UI && teamAccess.isMemberScope && Boolean(teamAccess.scopedMember);
  const memberTeamSharePullOpts =
    teamAccess.isMemberScope && teamAccess.scopedMember
      ? { ownMemberCode: teamAccess.scopedMember }
      : { ownMemberCode: memberCode };
  const showJournalLeaderToolbar = teamAccess.isLeader && !teamAccess.isMemberScope;
  // Leader /admin: backup + Supabase mirror stay available even when journal body is read-only.
  const showJournalBackupToolbar = showJournalLeaderToolbar;
  const showSupabaseMirrorTools = showJournalLeaderToolbar && SUPABASE_MANUAL_MIRROR_ENABLED;
  const showJournalStatusPanel = !journalReadOnly || showJournalLeaderToolbar;
  const showViewOnlyJsonImport =
    canImportViewOnlyJournalBackup && !showMemberTeamSharePull;
  const localMemberUpdatedAt = resolveLocalMemberUpdatedAt(journal.meta, memberCode);
  const {
    freshness: supabaseFreshness,
    setFreshness: setSupabaseFreshness,
    remoteUpdateNotified,
    clearRemoteUpdateNotice,
  } = useJournalSupabaseFreshness({
    enabled: showSupabaseMirrorTools,
    memberCode,
    localUpdatedAt: localMemberUpdatedAt,
  });
  const linkableImproveProjects = useMemo(
    () => filterImproveProjectsForMember(journal.improveProjects, memberCode),
    [journal.improveProjects, memberCode]
  );
  const memberOwnedImproveProjects = useMemo(
    () => filterImproveProjectsOwnedByMember(journal.improveProjects, memberCode),
    [journal.improveProjects, memberCode]
  );
  const memberKpiApprovalToolbar = useMemberKpiApprovalToolbarState(year, month, memberCode);
  const showMemberImproveProjectsToolbar =
    isMemberJournalScope && showImproveProjectPanel && !journalReadOnly;

  useEffect(() => {
    setCollapsedWeeks(loadCollapsedWeekKeys(year, month, memberCode));
  }, [year, month, memberCode]);

  useEffect(() => {
    setEditTask(null);
    setPanelOpen(false);
    setAddDayKey(null);
    setAddOpen(false);
    setCopyOpen(false);
    setMoveOpen(false);
    setLeaveOpen(false);
    setMemoOpen(false);
    setMemoTask(null);
    setMemoText('');
    setImproveProjectsModalOpen(false);
    setKpiApprovalModalOpen(false);
    setLeaveDayKey(null);
    setSelectedDayKey(null);
  }, [memberCode]);

  useEffect(() => {
    setSupabaseJournalSaveStatus('idle');
    setSupabaseJournalPullStatus('idle');
  }, [memberCode]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };
  const sharedSaveText = {
    queued: ' · 클라우드 동기화 대기 중',
    saving: ' · 클라우드 동기화 중',
    saved: ' · 클라우드 동기화 완료',
    conflict:
      ' · 클라우드 동기화 충돌 — 최신 내용을 불러오거나 확인한 뒤 다시 저장해 주세요',
    error: ' · 클라우드 동기화 실패 — 이 브라우저에는 임시 저장됨',
  }[journal.cloudSaveStatus] || '';
  const cloudHealthMessage = getCloudHealthUserMessage();
  const supabaseJournalSaveHint = SUPABASE_JOURNAL_SAVE_STATUS_LABEL[supabaseJournalSaveStatus] || '';
  const supabaseAutoMirrorHint =
    SUPABASE_AUTO_MIRROR_STATUS_LABEL[journal.supabaseMirrorSaveStatus] || '';

  const memberDays = journal.getMemberDays(memberCode);
  const knownTaskTitles = useMemo(
    () => collectJournalTaskTitles(memberDays),
    [memberDays]
  );

  const patchDay = useCallback(
    (key, updater) => journal.updateDay(key, updater, memberCode),
    [journal, memberCode]
  );

  const getDay = useCallback(
    (key) => resolveJournalDay(key, memberDays[key]),
    [memberDays]
  );

  const weeks = useMemo(() => getWeeksInMonth(year, month), [year, month]);

  const persistCollapsedWeeks = useCallback(
    (next) => {
      setCollapsedWeeks(next);
      saveCollapsedWeekKeys(year, month, next, memberCode);
    },
    [year, month, memberCode]
  );

  const toggleWeekTable = useCallback(
    (weekKey) => {
      setCollapsedWeeks((prev) => {
        const next = new Set(prev);
        if (next.has(weekKey)) next.delete(weekKey);
        else next.add(weekKey);
        saveCollapsedWeekKeys(year, month, next, memberCode);
        return next;
      });
    },
    [year, month, memberCode]
  );

  const collapseAllWeekTables = useCallback(() => {
    persistCollapsedWeeks(new Set(weeks.map((w) => w.key)));
  }, [weeks, persistCollapsedWeeks]);

  const expandAllWeekTables = useCallback(() => {
    persistCollapsedWeeks(new Set());
  }, [persistCollapsedWeeks]);

  const hiddenWeekCount = collapsedWeeks.size;
  const allWeekTablesHidden = weeks.length > 0 && hiddenWeekCount >= weeks.length;

  const monthMm = useMemo(() => {
    let totalAvail = 0;
    let totalCompleted = 0;
    weeks.forEach((week) => {
      const s = getWeekCompletionStats(week.days, month, getDay);
      totalAvail += s.available;
      totalCompleted += s.logged;
    });
    const shortage = Math.max(0, totalAvail - totalCompleted);
    const pct = totalAvail > 0 ? Math.min(100, (totalCompleted / totalAvail) * 100) : 100;
    return { totalAvail, totalCompleted, shortage, pct };
  }, [weeks, month, getDay]);

  const kpiMonth = useMemo(() => {
    let work = 0;
    let improve = 0;
    let leave = 0;
    let available = 0;
    let shortDays = 0;
    let doneTasks = 0;
    const seen = new Set();
    weeks.forEach((week) => {
      week.days.forEach((d) => {
        if (d.getMonth() !== month) return;
        const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
        if (seen.has(key)) return;
        seen.add(key);
        const day = getDay(key);
        work += day.mm.work;
        improve += day.mm.improve;
        leave += day.mm.leave;
        available += getDayAvailableMm(day);
        doneTasks += (day.tasks || []).filter((t) => t.done).length;
        const info = getDayHoursInfo(day);
        if (info.show && info.isShort) shortDays += 1;
      });
    });
    const reflected = work + improve + leave;
    const utilization = available > 0 ? (reflected / available) * 100 : null;
    const improveRatio = reflected > 0 ? (improve / reflected) * 100 : null;
    return {
      work,
      improve,
      leave,
      available,
      reflected,
      utilization,
      improveRatio,
      shortDays,
      kpi2EffectDone: countKpi2EffectTasks(journal.getMemberDays(memberCode), year, month),
    };
  }, [weeks, getDay, year, month, journal, memberCode]);

  const todayKey = useMemo(() => getTodayParts().key, []);
  const focusDayKey = selectedDayKey || todayKey;
  const focusDay = useMemo(() => getDay(focusDayKey), [focusDayKey, getDay]);
  const focusIsToday = focusDayKey === todayKey;
  const localSavedAtLabel = journal.meta?.updatedAt
    ? new Date(journal.meta.updatedAt).toLocaleString('ko-KR')
    : null;
  const localMemberSavedAtLabel = (() => {
    const at = resolveLocalMemberUpdatedAt(journal.meta, memberCode);
    return at ? new Date(at).toLocaleString('ko-KR') : null;
  })();
  const remoteFreshnessLabel = formatJournalFreshnessLabel(supabaseFreshness.status);
  const remoteSavedAtLabel = supabaseFreshness.remoteUpdatedAt
    ? new Date(supabaseFreshness.remoteUpdatedAt).toLocaleString('ko-KR')
    : null;

  const openPresetLeave = () => {
    const key =
      selectedDayKey || dateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    openLeave(key);
  };

  const saveSelectedMemberToSupabase = useCallback(async () => {
    if (!showSupabaseMirrorTools || supabaseJournalSaveStatus === 'saving') return;
    if (!SUPABASE_MANUAL_MIRROR_ENABLED) {
      setSupabaseJournalSaveStatus('disabled');
      showToast(SUPABASE_MANUAL_MIRROR_DISABLED_MESSAGE);
      return { ok: false, status: 'disabled', message: SUPABASE_MANUAL_MIRROR_DISABLED_MESSAGE };
    }
    const saveCode = memberCode;
    setSupabaseJournalSaveStatus('saving');
    const payload = buildMemberJournalSavePayload(
      journal.memberJournals?.[saveCode],
      journal.kpiOperational,
      saveCode
    );
    const result = await saveJournalSnapshotToSupabase({
      memberCode: saveCode,
      payload,
      updatedAt: journal.meta?.memberUpdatedAt?.[saveCode] || null,
    });

    if (result.ok) {
      setSupabaseJournalSaveStatus('ok');
      const remoteUpdatedAt =
        resolveRemoteSnapshotUpdatedAt(result.data) ||
        journal.meta?.memberUpdatedAt?.[saveCode] ||
        journal.meta?.updatedAt ||
        null;
      const localUpdatedAt =
        journal.meta?.memberUpdatedAt?.[saveCode] || null;
      setSupabaseFreshness({
        status: classifyJournalFreshness({ localUpdatedAt, remoteUpdatedAt }),
        remoteUpdatedAt,
        message: '',
      });
      showToast('Supabase 저장 완료');
      return result;
    }

    if (result.status === 'disabled') {
      setSupabaseJournalSaveStatus('disabled');
      showToast('Supabase 미설정');
      return result;
    }

    if (result.status === 'forbidden') {
      setSupabaseJournalSaveStatus('error');
      showToast(result.message || '관리자 세션이 필요합니다');
      return result;
    }

    if (result.status === 'conflict') {
      setSupabaseJournalSaveStatus('error');
      const remoteUpdatedAt = resolveRemoteSnapshotUpdatedAt(result.data);
      const localUpdatedAt = journal.meta?.memberUpdatedAt?.[saveCode] || null;
      setSupabaseFreshness({
        status: classifyJournalFreshness({ localUpdatedAt, remoteUpdatedAt }),
        remoteUpdatedAt,
        message: result.message || '',
      });
      showToast(result.message || '원격이 더 최신이라 저장하지 않았습니다');
      return result;
    }

    setSupabaseJournalSaveStatus('error');
    showToast(result.message || 'Supabase 저장 실패');
    return result;
  }, [journal, memberCode, showSupabaseMirrorTools, showToast, supabaseJournalSaveStatus]);

  const pullSelectedMemberFromSupabase = useCallback(async () => {
    if (!showSupabaseMirrorTools || supabaseJournalPullStatus === 'loading') return;
    if (!SUPABASE_MANUAL_MIRROR_ENABLED) {
      setSupabaseJournalPullStatus('disabled');
      showToast(SUPABASE_MANUAL_MIRROR_DISABLED_MESSAGE);
      return { ok: false, status: 'disabled' };
    }

    const pullCode = memberCode;
    const member = findKpiMember(pullCode);
    const memberLabel = member ? formatKpiMemberLabel(member) : pullCode;
    setSupabaseJournalPullStatus('loading');

    const remoteResult = await getJournalSnapshotFromSupabase(pullCode);
    if (!remoteResult.ok) {
      setSupabaseJournalPullStatus('error');
      showToast(remoteResult.message || 'Supabase 조회 실패');
      return remoteResult;
    }

    if (remoteResult.status === 'empty' || !remoteResult.data) {
      setSupabaseJournalPullStatus('empty');
      setSupabaseFreshness({
        status: JOURNAL_FRESHNESS_STATUS.empty,
        remoteUpdatedAt: null,
        message: '',
      });
      showToast('원격(Supabase) 스냅샷이 없습니다');
      return { ok: false, status: 'empty' };
    }

    const remoteUpdatedAt = resolveRemoteSnapshotUpdatedAt(remoteResult.data);
    const localUpdatedAt = resolveLocalMemberUpdatedAt(journal.meta, pullCode);
    const freshness = classifyJournalFreshness({ localUpdatedAt, remoteUpdatedAt });
    setSupabaseFreshness({
      status: freshness,
      remoteUpdatedAt,
      message: '',
    });

    const needsConfirm =
      freshness === JOURNAL_FRESHNESS_STATUS.localNewer ||
      freshness === JOURNAL_FRESHNESS_STATUS.equal;
    if (needsConfirm) {
      const confirmed = window.confirm(
        freshness === JOURNAL_FRESHNESS_STATUS.localNewer
          ? `${memberLabel} 로컬 일지가 원격보다 더 최신입니다. Supabase 내용으로 덮어쓸까요?`
          : `${memberLabel} 로컬과 원격 시각이 같습니다. Supabase 내용으로 다시 가져올까요?`
      );
      if (!confirmed) {
        setSupabaseJournalPullStatus('idle');
        showToast('가져오기를 취소했습니다');
        return { ok: false, status: 'cancelled' };
      }
    }

    const applied = journal.applyMemberFromSupabase(pullCode, remoteResult.data, {
      // Explicit pull always applies the remote slice; confirm already covered local-newer/equal.
      force: true,
    });
    if (!applied?.ok) {
      setSupabaseJournalPullStatus('error');
      showToast('로컬 반영에 실패했습니다');
      return { ok: false, status: 'error' };
    }

    setSupabaseJournalPullStatus('ok');
    setSupabaseFreshness({
      status: classifyJournalFreshness({
        localUpdatedAt: remoteUpdatedAt,
        remoteUpdatedAt,
      }),
      remoteUpdatedAt,
      message: '',
    });
    clearRemoteUpdateNotice();
    showToast(`${memberLabel} 일지를 Supabase에서 가져왔습니다`);
    return { ok: true, status: 'ok', changed: applied.changed };
  }, [
    journal,
    memberCode,
    showSupabaseMirrorTools,
    showToast,
    supabaseJournalPullStatus,
    clearRemoteUpdateNotice,
  ]);

  const runStorageComparison = useCallback(async () => {
    if (!SUPABASE_MANUAL_MIRROR_ENABLED) {
      setStorageComparisonStatus('idle');
      showToast(SUPABASE_MANUAL_MIRROR_DISABLED_MESSAGE);
      return;
    }
    setStorageComparisonStatus('loading');
    try {
      const [blobResult, teamResult] = await Promise.all([
        fetchJournalSnapshot(),
        fetchTeamJournalSnapshotFromSupabase(),
      ]);

      let supabaseError = null;
      let supabaseEmpty = true;
      let supabaseSnapshot = null;

      if (!teamResult?.ok) {
        supabaseError = teamResult;
      } else if (teamResult.snapshot) {
        supabaseEmpty = false;
        supabaseSnapshot = teamResult.snapshot;
      }

      const comparison = compareJournalSnapshots(
        blobResult?.snapshot || null,
        supabaseEmpty ? null : supabaseSnapshot
      );
      setStorageComparison({
        blobSource: blobResult?.source || 'empty',
        supabaseSource: teamResult?.source || 'supabase',
        primarySource: supabaseEmpty ? 'blob' : 'supabase',
        supabaseError,
        supabaseEmpty,
        ...comparison,
      });
      setStorageComparisonStatus('ready');
    } catch (error) {
      setStorageComparison({
        blobSource: 'error',
        supabaseSource: 'supabase',
        primarySource: 'blob',
        supabaseError: { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' },
        supabaseEmpty: true,
        blob: { exists: false, publishedAt: null, updatedAt: null, members: [] },
        supabase: { exists: false, publishedAt: null, updatedAt: null, members: [] },
        rows: [],
        diff: {
          blobOnlyMembers: [],
          supabaseOnlyMembers: [],
          updatedAtDiffMembers: [],
          taskCountDiffMembers: [],
          sameMembers: [],
          blobEmpty: true,
          supabaseEmpty: true,
        },
      });
      setStorageComparisonStatus('error');
    }
  }, [showToast]);

  const [scrollTick, setScrollTick] = useState(0);

  const goToToday = useCallback(() => {
    const { key } = getTodayParts();
    const scrollKey = resolveJournalScrollDayKey(key);
    pendingScrollToastRef.current =
      scrollKey !== key
        ? `${formatDayLabel(scrollKey)} (주말 → 해당 주 금요일)`
        : formatDayLabel(key);
    navigateToDayKey(scrollKey, {
      year,
      month,
      setPeriod,
      setSelectedDayKey,
      scrollToDayRef,
      setScrollTick,
    });
  }, [year, month, setPeriod]);

  useEffect(() => {
    const key = scrollToDayRef.current;
    if (!key) return undefined;

    const [y, m] = key.split('-').map(Number);
    const monthIndex = m - 1;
    const targetWeeks = getWeeksInMonth(y, monthIndex);
    const weekKey = findWeekKeyForDayKey(targetWeeks, key);

    if (weekKey && collapsedWeeks.has(weekKey)) {
      setCollapsedWeeks((prev) => {
        if (!prev.has(weekKey)) return prev;
        const next = new Set(prev);
        next.delete(weekKey);
        saveCollapsedWeekKeys(y, monthIndex, next, memberCode);
        return next;
      });
      return undefined;
    }

    return scheduleScrollJournalDay(key, journalMainRef.current, {
      onSuccess: () => {
        scrollToDayRef.current = null;
        if (pendingScrollToastRef.current) {
          showToast(`${pendingScrollToastRef.current} — 입력 셀로 이동`);
          pendingScrollToastRef.current = null;
        }
      },
      onFailure: () => {
        showToast('오늘 날짜 셀을 찾지 못했습니다. 주차 표를 펼친 뒤 다시 시도해 주세요.');
        pendingScrollToastRef.current = null;
      },
    });
  }, [scrollTick, year, month, collapsedWeeks, memberCode]);

  const openEdit = (taskId, dayKey) => {
    const day = getDay(dayKey);
    const task = day.tasks.find((t) => t.id === taskId);
    if (!task) return;
    setEditTask({ ...task, dayKey });
    setPanelOpen(true);
  };

  const openTaskMemo = (task, dayKey) => {
    setMemoTask({ id: task.id, title: task.title, dayKey });
    setMemoText(task.note || '');
    setMemoOpen(true);
  };

  const closeTaskMemo = () => {
    setMemoOpen(false);
    setMemoTask(null);
    setMemoText('');
  };

  const saveTaskMemo = () => {
    if (!memoTask || journalReadOnly) return;
    patchDay(memoTask.dayKey, (day) => ({
      ...day,
      tasks: day.tasks.map((task) =>
        task.id === memoTask.id ? { ...task, note: memoText.trim() } : task
      ),
    }));
    closeTaskMemo();
    showToast(memoText.trim() ? '업무 메모 저장됨' : '업무 메모 삭제됨');
  };

  const saveEdit = (e) => {
    e.preventDefault();
    if (!editTask || journalReadOnly) return;
    patchDay(editTask.dayKey, (day) => {
      const tasks = day.tasks.map((t) =>
        t.id === editTask.id ? mergeTaskFromEdit(t, editTask) : t
      );
      const next = { ...day, tasks };
      recalcDayMmFromHours(next);
      return next;
    });
    closeAll();
    showToast('저장됨');
  };

  const deleteTask = () => {
    if (!editTask || journalReadOnly) return;
    patchDay(editTask.dayKey, (day) => {
      const next = { ...day, tasks: day.tasks.filter((t) => t.id !== editTask.id) };
      recalcDayMmFromHours(next);
      return next;
    });
    closeAll();
    showToast('삭제됨');
  };

  const openCopyModal = () => {
    if (!editTask || journalReadOnly) return;
    setCopyTargetDayKey(editTask.dayKey);
    setCopyOpen(true);
  };

  const openMoveModal = () => {
    if (!editTask || journalReadOnly) return;
    setMoveTargetDayKey(editTask.dayKey);
    setMoveOpen(true);
  };

  const confirmCopy = () => {
    if (!editTask || journalReadOnly || !copyTargetDayKey) return;
    const sourceDayKey = editTask.dayKey;
    const sourceId = editTask.id;
    const copy = {
      id: `t-${Date.now()}`,
      cat: editTask.cat,
      title: editTask.title.trim(),
      note: editTask.note || '',
      plan: Number(editTask.plan) || 0,
      actual: 0,
      done: false,
      mmAxis: getMmAxisSelectValue(editTask),
      slot: resolveTaskSlotField(editTask.slot),
    };

    patchDay(sourceDayKey, (day) => {
      const tasks = day.tasks.map((t) =>
        t.id === sourceId ? mergeTaskFromEdit(t, editTask) : t
      );
      const next = { ...day, tasks };
      recalcDayMmFromHours(next);
      return next;
    });

    patchDay(copyTargetDayKey, (day) => {
      const next = { ...day, tasks: [...day.tasks, copy] };
      recalcDayMmFromHours(next);
      return next;
    });

    navigateToDayKey(copyTargetDayKey, {
      year,
      month,
      setPeriod,
      setSelectedDayKey,
      scrollToDayRef,
      setScrollTick,
    });
    setCopyOpen(false);
    setEditTask({ ...copy, dayKey: copyTargetDayKey });
    setPanelOpen(true);
    showToast(`${formatDayLabel(copyTargetDayKey)}에 복사됨 — 실작업(h)를 입력하세요`);
  };

  const confirmMove = () => {
    if (!editTask || journalReadOnly || !moveTargetDayKey) return;
    const sourceDayKey = editTask.dayKey;
    if (moveTargetDayKey === sourceDayKey) {
      showToast('이동할 날짜가 현재와 같습니다');
      return;
    }
    const moved = taskFieldsFromEdit(editTask);

    patchDay(sourceDayKey, (day) => {
      const next = { ...day, tasks: day.tasks.filter((t) => t.id !== editTask.id) };
      recalcDayMmFromHours(next);
      return next;
    });

    patchDay(moveTargetDayKey, (day) => {
      const next = { ...day, tasks: [...day.tasks, moved] };
      recalcDayMmFromHours(next);
      return next;
    });

    navigateToDayKey(moveTargetDayKey, {
      year,
      month,
      setPeriod,
      setSelectedDayKey,
      scrollToDayRef,
      setScrollTick,
    });
    setMoveOpen(false);
    setEditTask({ ...moved, dayKey: moveTargetDayKey });
    setPanelOpen(true);
    showToast(`${formatDayLabel(moveTargetDayKey)}(으)로 이동됨`);
  };

  const [addDraft, setAddDraft] = useState(DEFAULT_ADD_DRAFT);

  const openAdd = (dayKey) => {
    setAddDayKey(dayKey);
    setAddDraft(DEFAULT_ADD_DRAFT);
    setAddOpen(true);
  };

  const confirmAdd = () => {
    if (!addDayKey || journalReadOnly) return;
    if (!addDraft.title.trim()) {
      showToast('업무명을 입력하세요');
      return;
    }
    const plan = Number(addDraft.plan) || 0;
    const newId = `t-${Date.now()}`;
    const newTask = {
      id: newId,
      cat: addDraft.cat,
      title: addDraft.title.trim(),
      plan,
      actual: 0,
      done: false,
      note: '',
      mmAxis: addDraft.cat === 'ai' ? 'improve' : 'work',
      slot: resolveTaskSlotField(addDraft.slot),
    };
    const dayKey = addDayKey;
    patchDay(dayKey, (day) => {
      const next = {
        ...day,
        tasks: [...day.tasks, newTask],
      };
      recalcDayMmFromHours(next);
      return next;
    });
    setAddOpen(false);
    setEditTask({ ...newTask, dayKey });
    setPanelOpen(true);
    showToast('항목 추가됨 — 실작업(h)를 입력하세요');
  };

  const [leaveLeave, setLeaveLeave] = useState(0);

  const openLeave = (dayKey) => {
    const day = getDay(dayKey);
    setLeaveDayKey(dayKey);
    setLeaveLeave(day.mm.leave);
    setSelectedDayKey(dayKey);
    setLeaveOpen(true);
  };

  const applyLeavePreset = (preset) => {
    if (!leaveDayKey || journalReadOnly) return;
    let nextLeave = null;
    patchDay(leaveDayKey, (day) => {
      const next = applyLeavePresetToDay(day, preset, {
        publicHoliday: is2026PublicHoliday(leaveDayKey),
      });
      if (!next) return day;
      nextLeave = next.mm?.leave ?? null;
      recalcDayMmFromHours(next);
      return next;
    });
    if (nextLeave != null) setLeaveLeave(nextLeave);
    const label = LEAVE_PRESET_BUTTONS.find((b) => b.id === preset)?.label;
    if (label) showToast(`${label} 적용됨`);
  };

  const saveLeave = () => {
    if (!leaveDayKey || journalReadOnly) return;
    const leave = Number(leaveLeave) || 0;
    patchDay(leaveDayKey, (day) => {
      if (leave >= FULL_LEAVE_MM - 0.001) {
        return setPublicHolidayOverride(
          {
            ...day,
            holiday: true,
            mm: { work: 0, improve: 0, leave: FULL_LEAVE_MM },
            tasks: day.tasks,
          },
          false
        );
      }
      const next = setPublicHolidayOverride(
        { ...day, holiday: false, mm: { ...day.mm, leave } },
        is2026PublicHoliday(leaveDayKey)
      );
      recalcDayMmFromHours(next);
      return next;
    });
    closeAll();
    showToast('휴일 M/D 적용됨');
  };

  const closeAll = () => {
    setPanelOpen(false);
    setAddOpen(false);
    setCopyOpen(false);
    setMoveOpen(false);
    setLeaveOpen(false);
    setMemoOpen(false);
    setMemoTask(null);
    setMemoText('');
    setImproveProjectsModalOpen(false);
    setKpiApprovalModalOpen(false);
    setEditTask(null);
  };

  const leavePreview = leaveDayKey
    ? (() => {
        const d = { ...getDay(leaveDayKey), mm: { ...getDay(leaveDayKey).mm, leave: Number(leaveLeave) || 0 } };
        recalcDayMmFromHours(d);
        return d.mm;
      })()
    : null;

  const renderDayCell = (date) => {
    const y = date.getFullYear();
    const m = date.getMonth();
    const d = date.getDate();
    const key = dateKey(y, m, d);
    const inMonth = m === month;
    const data = getDay(key);
    const label = `${DAY_NAMES[date.getDay()]} ${m + 1}/${d}`;
    const hoursInfo = getDayHoursInfo(data);
    const isToday = key === dateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    const journalReadOnlyCls = journalReadOnly ? ' journal-readonly' : '';

    if (!inMonth) {
      return (
        <td key={key} className="journal-day-cell" style={{ opacity: 0.35 }}>
          <div>{label}</div>
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        </td>
      );
    }

    return (
      <td
        key={key}
        data-day={key}
        className={`journal-day-cell${selectedDayKey === key ? ' is-selected' : ''}${isToday ? ' is-today' : ''}${hoursInfo.show && hoursInfo.isShort ? ' is-hours-short' : ''}${journalReadOnlyCls}`}
        onClick={() => setSelectedDayKey(key)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <strong style={{ fontSize: '0.85rem' }}>
            {label}
            {isToday && (
              <span style={{ marginLeft: 6, fontSize: '0.65rem', color: 'var(--secondary)' }}>오늘</span>
            )}
          </strong>
          {hoursInfo.show &&
            (() => {
              const badge = formatDayHoursBadge(hoursInfo);
              return hoursInfo.isShort ? (
                <span className="hours-badge short" title={badge.title}>
                  ⚠ {badge.label}
                </span>
              ) : (
                <span className="hours-badge ok" title={badge.title}>
                  ✓ {badge.label}
                </span>
              );
            })()}
        </div>
        {data.holiday && <div style={{ color: 'var(--accent)', fontSize: '0.75rem' }}>공휴일</div>}
        <ul className="journal-task-list">
          {sortTasksBySlot(data.tasks).map((t) => {
            const hoursLine = formatTaskHoursLine(t);
            const slotLabel = getTaskSlotLabel(t.slot);
            return (
            <li
              key={t.id}
              className={`journal-task-item${editTask?.id === t.id ? ' selected' : ''}${hoursLine && !(Number(t.actual) > 0) ? ' is-planned' : ''}${slotLabel ? ` slot-${normalizeTaskSlot(t.slot)}` : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!journalReadOnly) openEdit(t.id, key);
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: memberCategoryView.cats[t.cat]?.color, flexShrink: 0, marginTop: 5 }} />
              <span className="journal-task-body">
                <span className="journal-task-title-row">
                  {slotLabel && <span className={`journal-task-slot slot-${normalizeTaskSlot(t.slot)}`}>{slotLabel}</span>}
                  <span className="journal-task-title">{t.title}</span>
                </span>
                {hoursLine && (
                  <small
                    className={Number(t.actual) > 0 ? '' : 'journal-task-hours-plan'}
                    style={{ display: 'block', color: 'var(--text-muted)' }}
                  >
                    {hoursLine}
                  </small>
                )}
              </span>
              <span className="journal-task-meta">
                <TaskKpiBadge task={t} dayKey={key} improveProjects={journal.improveProjects} />
                <TaskMmPill task={t} />
                <button
                  type="button"
                  className={`journal-task-memo-btn${t.note ? ' has-memo' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    openTaskMemo(t, key);
                  }}
                  aria-label={`${t.title} 업무 메모 ${t.note ? '보기' : '작성'}`}
                  title={t.note ? '메모 있음' : '메모 작성'}
                >
                  <MessageSquare size={13} aria-hidden />
                  {t.note ? '메모 있음' : '메모'}
                </button>
                {t.done && <span className="journal-task-done">✓</span>}
              </span>
            </li>
            );
          })}
        </ul>
        <div className="journal-mm-row">
          <button type="button" className={`journal-mm-chip${data.mm.leave > 0 ? ' leave-active' : ''}`} onClick={(e) => { e.stopPropagation(); if (!journalReadOnly) openLeave(key); }}>
            업무 {data.mm.work}
          </button>
          <button type="button" className="journal-mm-chip" onClick={(e) => { e.stopPropagation(); if (!journalReadOnly) openLeave(key); }}>
            향상 {data.mm.improve}
          </button>
          <button type="button" className={`journal-mm-chip${data.mm.leave > 0 ? ' leave-active' : ''}`} onClick={(e) => { e.stopPropagation(); if (!journalReadOnly) openLeave(key); }}>
            휴일 {data.mm.leave}
          </button>
        </div>
        {!journalReadOnly && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '0.25rem 0.4rem' }} onClick={(e) => { e.stopPropagation(); openAdd(key); }}>
              + 항목
            </button>
            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '0.25rem 0.4rem' }} onClick={(e) => { e.stopPropagation(); openLeave(key); }}>
              휴일
            </button>
          </div>
        )}
      </td>
    );
  };

  return (
    <main className="journal-main" ref={journalMainRef}>
      <div className="journal-glow journal-glow-1" aria-hidden="true" />
      <div className="journal-glow journal-glow-2" aria-hidden="true" />
      <div className="journal-content">
        <div className="journal-sticky-top">
          <header className="journal-page-header">
            <div className="journal-month-nav">
              <button
                type="button"
                className="journal-icon-btn"
                onClick={() => changeMonth(-1)}
                aria-label="이전 달"
                {...uiTooltip('이전 달로 이동')}
              >
                <ChevronLeft size={18} />
              </button>
              <h1>
                {year}년 {month + 1}월
              </h1>
              <button
                type="button"
                className="journal-icon-btn"
                onClick={() => changeMonth(1)}
                aria-label="다음 달"
                {...uiTooltip('다음 달로 이동')}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="journal-author-chip">
              {teamAccess.isMemberScope ? (
                <>
                  구성원 <strong>{memberCode}</strong> 업무일지 ·{' '}
                  <strong>{selectedMember.displayName}</strong>{' '}
                  <span>({formatKpiMemberRoleLine(selectedMember)}){journalReadOnly ? ' · 조회' : ''}</span>
                </>
              ) : (
                <>
                  작성자 <strong>{selectedMember.displayName}</strong>{' '}
                  <span>
                    ({formatKpiMemberRoleLine(selectedMember)}){journalReadOnly ? ' · 조회' : ''}
                  </span>
                </>
              )}
            </div>
            <div className="journal-actions">
              {showJournalLeaderToolbar && (
                <AppModuleLink
                  className="btn btn-secondary"
                  module="kpi"
                  mode="edit"
                  access={URL_ACCESS_ADMIN}
                  year={year}
                  month={month + 1}
                  style={{ textDecoration: 'none' }}
                  {...uiTooltip('팀 KPI 관리 (관리자)')}
                >
                  팀 KPI 관리 →
                </AppModuleLink>
              )}
              {showSupabaseMirrorTools && (
                <button
                  type="button"
                  className="btn btn-secondary journal-member-tool-btn"
                  onClick={runStorageComparison}
                  disabled={storageComparisonStatus === 'loading'}
                  {...uiTooltip(
                    'Blob 팀 공유본과 Supabase journal snapshot을 읽기 전용으로 비교합니다. /admin 세션으로 API 경유합니다.',
                    undefined,
                    {
                    wrap: true,
                  })}
                >
                  <Search size={16} />
                  {storageComparisonStatus === 'loading' ? '저장소 점검 중…' : '저장소 비교'}
                </button>
              )}
              {showSupabaseMirrorTools && (
                <button
                  type="button"
                  className="btn btn-secondary journal-member-tool-btn"
                  disabled={supabaseJournalSaveStatus === 'saving'}
                  onClick={saveSelectedMemberToSupabase}
                  {...uiTooltip(
                    '현재 선택한 구성원의 업무일지를 /api/journal-snapshots(admin 세션)로 Supabase에 수동 저장합니다. Preview에서는 로컬 저장 후 자동 미러(debounce)도 동작합니다.',
                    undefined,
                    { wrap: true }
                  )}
                >
                  <Save size={16} />
                  {supabaseJournalSaveStatus === 'saving' ? '저장 중…' : 'Supabase 업무일지 저장'}
                </button>
              )}
              {showSupabaseMirrorTools && (
                <button
                  type="button"
                  className="btn btn-secondary journal-member-tool-btn"
                  disabled={supabaseJournalPullStatus === 'loading'}
                  onClick={pullSelectedMemberFromSupabase}
                  {...uiTooltip(
                    '현재 선택한 구성원의 Supabase 스냅샷을 이 브라우저 로컬 일지로 가져옵니다. 로컬이 더 최신이면 확인 후 덮어씁니다.',
                    undefined,
                    { wrap: true }
                  )}
                >
                  <Import size={16} />
                  {supabaseJournalPullStatus === 'loading'
                    ? '가져오는 중…'
                    : 'Supabase에서 가져오기'}
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={goToToday}
                {...uiTooltip('오늘 날짜로 스크롤')}
              >
                <Target size={16} />
                오늘로 이동
              </button>
              {showMemberImproveProjectsToolbar && (
                <button
                  type="button"
                  className="btn btn-secondary journal-member-tool-btn"
                  onClick={() => setImproveProjectsModalOpen(true)}
                  {...uiTooltip('본인 담당 생산성향상 과제 목록 · 팀 공유본 가져오기')}
                >
                  <Sparkles size={16} />
                  향상 과제
                  {memberOwnedImproveProjects.length > 0 && (
                    <span className="journal-member-tool-badge">{memberOwnedImproveProjects.length}</span>
                  )}
                </button>
              )}
              {showMemberKpiApproval && (
                <button
                  type="button"
                  className={`btn btn-secondary journal-member-tool-btn${
                    memberKpiApprovalToolbar.needsAttention ? ' journal-member-tool-btn--attention' : ''
                  }`}
                  onClick={() => setKpiApprovalModalOpen(true)}
                  {...uiTooltip('KPI1 월 확정 · KPI2 효과 승인 요청')}
                >
                  <Send size={16} />
                  KPI 승인 요청
                  {memberKpiApprovalToolbar.needsAttention && (
                    <span className="journal-member-tool-badge journal-member-tool-badge--attention">!</span>
                  )}
                </button>
              )}
              {(showMemberTeamSharePull || (!journalReadOnly && showJournalTeamShareControls)) && (
                <button
                  type="button"
                  className="btn btn-import-shared"
                  aria-label="팀 공유본 가져오기"
                  {...uiTooltip(
                    showMemberTeamSharePull
                      ? '팀 공유 일지를 수동으로 가져옵니다. 기본은 본인 일지 유지이며, 확인 시 본인 일지도 포함해 병합할 수 있습니다.'
                      : '팀 공유 일지를 수동으로 가져옵니다. 자동 동기화는 사용하지 않습니다.',
                    undefined,
                    { wrap: true }
                  )}
                  onClick={async () => {
                    if (showMemberTeamSharePull) {
                      setShareImportChoiceOpen(true);
                      return;
                    }
                    try {
                      const r = await journal.pullFromCloud({
                        ...memberTeamSharePullOpts,
                        includeOwnMember: true,
                      });
                      showToast(journalPullToastMessage(r));
                    } catch (e) {
                      showToast(e.message);
                    }
                  }}
                >
                  <Import size={16} />
                  팀 공유본 가져오기
                </button>
              )}
              {!journalReadOnly && (
                <>
                  {canSaveJournalTeamShare && (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary"
                        aria-label="팀 공유 저장"
                        {...uiTooltip(
                          JOURNAL_BLOB_POST_ENABLED
                            ? '본인 일지를 팀 공유 저장소에 수동 업로드합니다. 자동 저장은 사용하지 않습니다.'
                            : '본인 일지를 Supabase 팀 공유 저장소에 수동 업로드합니다. Blob POST는 비활성(J7d)입니다.',
                          undefined,
                          { wrap: true }
                        )}
                        onClick={async () => {
                          const saveCode = teamAccess.scopedMember || memberCode;
                          const r = await journal.saveMemberToCloud(saveCode);
                          if (r.ok) {
                            const mirror = r.supabaseMirror;
                            if (r.source === 'supabase') {
                              showToast(`${saveCode} 일지를 Supabase 팀 공유 저장소에 저장했습니다`);
                            } else if (
                              SUPABASE_MANUAL_MIRROR_ENABLED &&
                              mirror &&
                              !mirror.ok &&
                              mirror.status !== 'disabled'
                            ) {
                              showToast(
                                `${saveCode} 일지를 팀 공유 저장소에 저장했습니다 (Supabase 미러 실패)`
                              );
                            } else {
                              showToast(`${saveCode} 일지를 팀 공유 저장소에 저장했습니다`);
                            }
                          } else if (r.reason === 'conflict') {
                            showToast(
                              '이 저널은 다른 곳에서 더 최신 내용으로 업데이트되었습니다. 최신 내용을 불러오거나 변경 내용을 확인한 뒤 다시 저장해 주세요.'
                            );
                          } else if (r.reason === 'empty-payload') {
                            showToast(r.error?.message || '빈 일지로는 팀 공유 저장할 수 없습니다');
                          } else if (r.reason === 'blob-demoted') {
                            showToast(r.error?.message || JOURNAL_BLOB_POST_DISABLED_MESSAGE);
                          } else {
                            showToast(r.error?.message || '팀 공유 저장 실패 — 이 브라우저에는 임시 저장됨');
                          }
                        }}
                      >
                        <Upload size={16} />
                        팀 공유 저장
                      </button>
                    </>
                  )}
                  {showJournalBackupToolbar && (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        {...uiTooltip('수동 복구·배포를 위한 백업 JSON 파일 생성')}
                        onClick={() => {
                          journal.downloadJournalBackup();
                          showToast('백업용 JSON 파일을 다운로드했습니다.');
                        }}
                      >
                        <Download size={16} />
                        백업용 JSON 다운로드
                      </button>
                      {canImportJournalBackup && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => importInputRef.current?.click()}
                          {...uiTooltip('일지 백업 JSON 가져오기')}
                        >
                          <Upload size={16} />
                          백업 가져오기
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={openPresetLeave}
                        {...uiTooltip('휴일 프리셋 적용')}
                      >
                        휴일 프리셋
                      </button>
                    </>
                  )}
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        await journal.importJournalBackup(file);
                        showToast('백업 파일을 반영했습니다');
                      } catch (err) {
                        showToast(`가져오기 실패: ${err.message}`);
                      }
                      e.target.value = '';
                    }}
                  />
                </>
              )}
              {showViewOnlyJsonImport && (
                <>
                  <button
                    type="button"
                    className="btn btn-import-shared"
                    onClick={() => viewOnlyImportInputRef.current?.click()}
                    {...uiTooltip(
                      '팀장이 보낸 백업 JSON에서 타인(A/C) 일지를 이 브라우저에 조회용으로 반영합니다. 본인 일지는 변경되지 않습니다.',
                      undefined,
                      { wrap: true }
                    )}
                  >
                    <Import size={16} />
                    조회용 JSON 가져오기
                  </button>
                  <input
                    ref={viewOnlyImportInputRef}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        await journal.importJournalViewOnlyBackup(file, teamAccess.scopedMember);
                        showToast(
                          '조회용 JSON을 반영했습니다 — A/B/C 탭에서 타인 일지를 확인하세요. 본인 일지는 그대로입니다.'
                        );
                      } catch (err) {
                        showToast(`가져오기 실패: ${err.message}`);
                      }
                      e.target.value = '';
                    }}
                  />
                </>
              )}
            </div>
          </header>

          {showJournalStatusPanel && (
            <section className="journal-status-panel" aria-label="선택 날짜 및 저장 상태">
              <h2 className="journal-status-panel__title">{formatJournalDayHeading(focusDayKey)}</h2>
              <p className="journal-status-panel__meta">
                {journalReadOnly ? (
                  <span>관리자 조회 · 일지 본문 수정은 구성원 URL에서만 가능합니다</span>
                ) : focusIsToday ? (
                  <span className="journal-status-panel__today">오늘 작성 중</span>
                ) : (
                  <span>선택한 날짜 · 표에서 날짜 셀을 눌러 변경</span>
                )}
                <span className="journal-status-panel__sep" aria-hidden="true">
                  ·
                </span>
                <span>{describeFocusDayTasks(focusDay.tasks)}</span>
              </p>
              {supabaseJournalSaveHint && (
                <p
                  className={`journal-sync-hint${
                    supabaseJournalSaveStatus === 'error' || supabaseJournalSaveStatus === 'disabled'
                      ? ' journal-sync-hint--warn'
                      : ''
                  }`}
                >
                  {supabaseJournalSaveHint}
                </p>
              )}
              {showSupabaseMirrorTools && supabaseAutoMirrorHint && (
                <p
                  className={`journal-sync-hint${
                    journal.supabaseMirrorSaveStatus === 'conflict' ||
                    journal.supabaseMirrorSaveStatus === 'error'
                      ? ' journal-sync-hint--warn'
                      : ''
                  }`}
                  aria-live="polite"
                >
                  {supabaseAutoMirrorHint}
                </p>
              )}
              <p className="journal-status-panel__save">
                {localSavedAtLabel ? (
                  <>로컬 저장됨 ({localSavedAtLabel})</>
                ) : (
                  <>저장은 이 브라우저에 먼저 반영됩니다.</>
                )}
              </p>
              {showSupabaseMirrorTools && remoteFreshnessLabel && (
                <p
                  className={`journal-sync-hint journal-freshness-hint${
                    supabaseFreshness.status === JOURNAL_FRESHNESS_STATUS.remoteNewer ||
                    remoteUpdateNotified ||
                    supabaseFreshness.status === JOURNAL_FRESHNESS_STATUS.error ||
                    supabaseFreshness.status === JOURNAL_FRESHNESS_STATUS.disabled
                      ? ' journal-sync-hint--warn'
                      : ''
                  }`}
                  aria-live="polite"
                >
                  {remoteFreshnessLabel}
                  {remoteSavedAtLabel ? ` · 원격 ${remoteSavedAtLabel}` : ''}
                  {localMemberSavedAtLabel &&
                  supabaseFreshness.status !== JOURNAL_FRESHNESS_STATUS.loading
                    ? ` · 로컬(구성원) ${localMemberSavedAtLabel}`
                    : ''}
                  {supabaseFreshness.status === JOURNAL_FRESHNESS_STATUS.remoteNewer
                    ? ' · 「Supabase에서 가져오기」로 복구할 수 있습니다'
                    : ''}
                </p>
              )}
            </section>
          )}

          {showSupabaseMirrorTools && storageComparison && (
            <section className="journal-storage-compare-panel" aria-label="Supabase와 Blob 저장소 비교">
              <h3 className="journal-storage-compare-panel__title">저장소 비교</h3>
              <p className="journal-field-help">
                읽기 전용 진단입니다. Preview에서는 팀 공유 SoT를 Supabase로 보고, Blob은 fallback으로
                비교합니다. 기존 일지 상태는 변경하지 않습니다.
              </p>
              <div className="journal-storage-compare-panel__cards">
                <article className="journal-storage-compare-card">
                  <strong>Supabase (팀 공유 SoT)</strong>
                  <p>
                    {storageComparison.supabaseError
                      ? storageComparison.supabaseError.message || '조회 실패'
                      : storageComparison.supabase.exists
                        ? '존재함'
                        : '없음'}
                  </p>
                  <p>updatedAt: {storageComparison.supabase.updatedAt || '없음'}</p>
                  <p>상태: {storageComparisonStatus === 'error' ? '오류' : '조회 완료'}</p>
                </article>
                <article className="journal-storage-compare-card">
                  <strong>Blob (fallback)</strong>
                  <p>{storageComparison.blob.exists ? '존재함' : '없음'}</p>
                  <p>publishedAt: {storageComparison.blob.publishedAt || '없음'}</p>
                  <p>updatedAt: {storageComparison.blob.updatedAt || '없음'}</p>
                </article>
              </div>
              <div className="journal-storage-compare-panel__summary">
                <p>
                  Supabase에만 있는 구성원: {storageComparison.diff.supabaseOnlyMembers.join(', ') || '없음'}
                </p>
                <p>Blob에만 있는 구성원: {storageComparison.diff.blobOnlyMembers.join(', ') || '없음'}</p>
                <p>
                  updatedAt 차이: {storageComparison.diff.updatedAtDiffMembers.join(', ') || '없음'}
                </p>
                <p>
                  task count 차이: {storageComparison.diff.taskCountDiffMembers.join(', ') || '없음'}
                </p>
                <p>동일해 보이는 구성원: {storageComparison.diff.sameMembers.join(', ') || '없음'}</p>
              </div>
              <table className="journal-storage-compare-table">
                <thead>
                  <tr>
                    <th>구성원</th>
                    <th>Supabase</th>
                    <th>Blob</th>
                    <th>비교 결과</th>
                  </tr>
                </thead>
                <tbody>
                  {storageComparison.rows.map((row) => (
                    <tr key={row.code}>
                      <td>
                        {row.code} {row.displayName}
                      </td>
                      <td>
                        {row.supabase.exists
                          ? `있음 · ${row.supabase.tasks} tasks · ${row.supabase.updatedAt || 'updatedAt 없음'}`
                          : '없음'}
                      </td>
                      <td>
                        {row.blob.exists ? `있음 · ${row.blob.tasks} tasks · ${row.blob.updatedAt || 'updatedAt 없음'}` : '없음'}
                      </td>
                      <td>{row.status === 'same' ? '동일' : row.status === 'different' ? '차이 있음' : row.status === 'blob-only' ? 'Blob만 있음' : row.status === 'supabase-only' ? 'Supabase만 있음' : '데이터 없음'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {storageComparison.supabaseError && (
                <p className="journal-sync-hint journal-sync-hint--warn">
                  Supabase 조회 오류: {storageComparison.supabaseError.message || '알 수 없는 오류'}
                </p>
              )}
            </section>
          )}

          {!journalReadOnly && (
            <details className="journal-kpi-help">
              <summary>M/D · KPI2 효과 안내</summary>
              <ul>
                <li>
                  <strong>일반 업무 M/D</strong>: 실제 투입 시간을 기록합니다. (실작업 h ÷ 8)
                </li>
                <li>
                  <strong>생산성향상 M/D</strong>: 개선·자동화·효율화 성격의 업무 시간을 기록합니다.
                </li>
                <li>
                  <strong>{KPI2_NAME} 효과</strong>: 개선 효과로 제출할 항목만 체크합니다.
                </li>
                <li>
                  <strong>완료 체크</strong>: 체크한 업무의 실작업(h)만 M/D·가동률·일일 실작업 합계에 반영됩니다.
                </li>
              </ul>
            </details>
          )}

          {showImproveProjectPanel && !isMemberJournalScope && (
            <section className="journal-improve-projects-panel" aria-label="운영 중인 생산성향상 과제">
              <h3 className="journal-improve-projects-panel__title">운영 중인 생산성향상 과제</h3>
              <p className="journal-field-help">
                팀장이 KPI2 운영 목록에 등록한 향상 과제입니다. 관련 업무를 작성할 때 과제를 선택해 연결할 수
                있습니다.
              </p>
              <p className="journal-sync-hint">{IMPROVE_PROJECT_JOURNAL_SCOPE_NOTICE}</p>
              {IMPROVE_PROJECT_BLOB_SHARE_ENABLED && cloudHealthMessage && (
                <p className="journal-sync-hint journal-sync-hint--warn">{cloudHealthMessage}</p>
              )}
              <div className="journal-improve-projects-panel__actions">
                {IMPROVE_PROJECT_BLOB_SHARE_ENABLED && (
                  <button
                    type="button"
                    className="btn btn-import-shared"
                    disabled={journal.improveProjectsApi.sharedBusy}
                    aria-label="향상 과제 팀 공유본 가져오기"
                    {...uiTooltip(
                      '팀장이 공유 저장한 향상 과제 운영 목록을 수동으로 가져옵니다. 자동 동기화는 사용하지 않습니다.',
                      undefined,
                      { wrap: true }
                    )}
                    onClick={async () => {
                      const r = await journal.improveProjectsApi.loadSharedProjects();
                      if (r.ok) {
                        showToast(
                          describeImproveProjectsShareImport(r.merged || [], memberCode)
                        );
                      } else if (r.reason === 'no-remote') showToast('팀 공유본이 아직 없습니다');
                      else showToast(r.message || '팀 공유본을 가져오지 못했습니다');
                    }}
                  >
                    <Import size={16} />
                    팀 공유본 가져오기
                  </button>
                )}
              </div>
              {linkableImproveProjects.length === 0 ? (
                <p className="journal-improve-projects-panel__empty">
                  아직 연결 가능한 향상 과제가 없습니다. 생산성향상 M/D 업무를 작성하면 팀장 KPI 화면에서 후보로
                  확인할 수 있습니다.
                </p>
              ) : (
                <ul className="journal-improve-projects-panel__list">
                  {linkableImproveProjects.map((p) => (
                    <li key={p.id}>
                      <strong>{p.name}</strong>
                      <span className="journal-improve-projects-panel__meta">
                        {formatImproveProjectOwnerLine(p, (code) => {
                          const m = findKpiMember(code);
                          return m ? `${m.code}(${m.displayName})` : code;
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <nav className="journal-member-tabs" aria-label="구성원 일지">
            {TEAM_KPI_MEMBERS.map((m) => {
              const tabViewOnly = !canEditMemberJournal(teamAccess, m.code);
              return (
                <button
                  key={m.code}
                  type="button"
                  className={`journal-member-tab${memberCode === m.code ? ' is-active' : ''}${tabViewOnly && teamAccess.memberLocked ? ' is-view-only' : ''}`}
                  onClick={() => {
                    setMemberCode(m.code);
                    if (teamAccess.isLeader && !teamAccess.memberLocked) {
                      applyLeaderJournalMemberToUrl(m.code);
                    }
                  }}
                  {...uiTooltip(
                    tabViewOnly && teamAccess.memberLocked
                      ? `${formatKpiMemberLabel(m)} · 조회 전용`
                      : `${formatKpiMemberLabel(m)} · ${formatKpiMemberRoleLine(m)}`
                  )}
                >
                  {formatKpiMemberLabel(m)}
                  {tabViewOnly && teamAccess.memberLocked && m.code !== teamAccess.scopedMember ? (
                    <span className="journal-member-tab__badge">조회</span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          {viewingOtherMember && (
            <p className="journal-sync-hint journal-sync-hint--view-other">
              <strong>{formatKpiMemberLabel(selectedMember)}</strong> 일지는{' '}
              <strong>조회만</strong> 가능합니다. 작성·수정은 본인(
              {teamAccess.scopedMember}) 탭에서 하세요. 타인 일지가 비어 있으면 상단{' '}
              {SHOW_BC_JOURNAL_TEAM_SHARE_UI && teamAccess.isMemberScope ? (
                <>
                  <strong>「팀 공유본 가져오기」</strong>로 팀 공유 저장소에서 불러오세요.
                </>
              ) : (
                <>
                  <strong>「조회용 JSON 가져오기」</strong>로 팀장이 보낸 백업 파일을 불러오세요.
                </>
              )}
            </p>
          )}

          {!journalReadOnly && journal.meta?.updatedAt && (
            <p className="journal-sync-hint">
              이 기기 저장: {new Date(journal.meta.updatedAt).toLocaleString('ko-KR')}
              {journal.syncStatus === 'synced' && ' · 공유 일지 병합됨'}
              {sharedSaveText}
            </p>
          )}
          {!journalReadOnly && cloudHealthMessage && (
            <p className="journal-sync-hint journal-sync-hint--warn">{cloudHealthMessage}</p>
          )}
          {!journalReadOnly && (
            <p className="journal-sync-hint">
              항목 저장·수정은 <strong>이 브라우저(localStorage)</strong>에 먼저 반영됩니다.
              {showJournalTeamShareControls ? (
                <>
                  팀 공유가 필요할 때만 「팀 공유 저장」·「팀 공유본 가져오기」를 사용하세요.{' '}
                  가져오기는 본인 일지는 유지하고 타 구성원 일지만 갱신합니다. 현재 자동 클라우드
                  동기화는 꺼져 있으며, 공유 저장은 수동으로 실행할 때만 반영됩니다.
                </>
              ) : (
                <>
                  향상 과제 공유는 「팀장에게 받은 JSON 가져오기」를 사용하세요.{' '}
                  현재 자동 클라우드 동기화는 꺼져 있으며, 공유 저장은 수동으로 실행할 때만 반영됩니다.
                </>
              )}
            </p>
          )}
        </div>

        <div className="journal-summary-blocks">
          <div className="journal-kpi-strip">
            <p className="journal-kpi-strip-member">
              {formatKpiMemberLabel(selectedMember)} · {month + 1}월 KPI1 집계
            </p>
            <div className="journal-kpi-strip-grid">
            <div>
              업무 M/D ({month + 1}월)
              <strong>{kpiMonth.work.toFixed(2)}</strong>
            </div>
            <div>
              생산향상 M/D
              <strong>{kpiMonth.improve.toFixed(2)}</strong>
            </div>
            <div>
              휴일 M/D
              <strong>{kpiMonth.leave.toFixed(2)}</strong>
            </div>
            <div>
              반영 M/D
              <strong>{kpiMonth.reflected.toFixed(2)}</strong>
            </div>
            <div>
              가용 M/D
              <strong>{kpiMonth.available.toFixed(2)}</strong>
            </div>
            <div>
              현재 가동률
              <strong>{formatSummaryPct(kpiMonth.utilization)}</strong>
            </div>
            <div>
              생산성향상 비율
              <strong>{formatSummaryPct(kpiMonth.improveRatio)}</strong>
            </div>
            <div>
              {KPI2_NAME} 효과 (완료)
              <strong>{kpiMonth.kpi2EffectDone}건</strong>
            </div>
            <div>
              8h 미만 근무일
              <strong className={kpiMonth.shortDays ? 'is-warn' : ''}>{kpiMonth.shortDays}일</strong>
            </div>
            </div>
          </div>

          <div className="journal-mm-panel">
          <div className="journal-mm-panel-head">
            <h2>
                월 업무일지 입력 현황 — {selectedMember.displayName}
              </h2>
              <div className="journal-mm-panel-meta">
                주차별 완료 M/D <strong>{monthMm.totalCompleted.toFixed(2)}</strong> / 가용{' '}
                <strong>{monthMm.totalAvail.toFixed(2)}</strong> M/D
                {monthMm.shortage > 0.001 ? (
                  <span className="shortage"> · 부족 {monthMm.shortage.toFixed(2)} M/D</span>
                ) : (
                  <span className="ok"> · 주차별 완료 M/D 기준 충족</span>
                )}
              </div>
            </div>
            <div className="journal-progress-track journal-progress-track--month">
              <div
                className={`journal-progress-fill${monthMm.shortage > 0.001 ? ' warn' : ''}`}
                style={{ width: `${monthMm.pct.toFixed(1)}%` }}
              />
            </div>
            <p className="journal-mm-hint">주차별 완료 M/D 기준 · 완료된 업무(h)÷8 자동 · 평일 가용 1.0(8h 기준)</p>
          </div>
        </div>

        {weeks.length > 0 && (
          <div className="journal-week-visibility-bar">
            <span className="journal-week-visibility-label">
              주차별 표
              {hiddenWeekCount > 0 ? (
                <span className="journal-week-visibility-count"> · {hiddenWeekCount}주 숨김</span>
              ) : null}
            </span>
            <JournalCategoryLegend
              className="journal-category-legend--week"
              categories={memberCategoryView.cats}
              order={memberCategoryView.order}
            />
            {!journalReadOnly && (
              <button
                type="button"
                className="btn btn-secondary journal-member-prefs-btn"
                {...uiTooltip(`${formatKpiMemberLabel(selectedMember)} 범례·금주/차주 기본 양식`)}
                onClick={() => setMemberPrefsOpen(true)}
              >
                범례·양식
              </button>
            )}
            <div className="journal-week-visibility-actions">
              <button
                type="button"
                className="btn btn-secondary journal-week-visibility-btn"
                onClick={allWeekTablesHidden ? expandAllWeekTables : collapseAllWeekTables}
              >
                {allWeekTablesHidden ? (
                  <>
                    <ChevronDown size={16} />
                    주차 표 모두 보기
                  </>
                ) : (
                  <>
                    <ChevronUp size={16} />
                    주차 표 모두 숨기기
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {weeks.map((week) => {
          const stats = getWeekCompletionStats(week.days, month, getDay);
          const fmt = (dt) => `${dt.getMonth() + 1}/${dt.getDate()}`;
          const start = week.days[0];
          const end = week.days[4];
          const tableHidden = collapsedWeeks.has(week.key);
          return (
            <section
              key={week.key}
              className={`journal-week-block${tableHidden ? ' is-table-collapsed' : ''}`}
            >
              <div className="journal-week-head">
                <div className="journal-week-title-row">
                  <h2 className="journal-week-title">
                    {week.index}째주 ({fmt(start)} ~ {fmt(end)})
                  </h2>
                  <button
                    type="button"
                    className="journal-week-toggle"
                    onClick={() => toggleWeekTable(week.key)}
                    aria-expanded={!tableHidden}
                    aria-controls={`journal-week-table-${week.key}`}
                  >
                    {tableHidden ? (
                      <>
                        <ChevronDown size={16} aria-hidden />
                        표 보기
                      </>
                    ) : (
                      <>
                        <ChevronUp size={16} aria-hidden />
                        표 숨기기
                      </>
                    )}
                  </button>
                  <span className="journal-week-mm-meta">
                    완료 <strong>{stats.logged.toFixed(2)}</strong> / 가용 <strong>{stats.available.toFixed(2)}</strong> M/D
                    {stats.shortage > 0.001 ? (
                      <span className="shortage"> · 부족 {stats.shortage.toFixed(2)}</span>
                    ) : (
                      <span className="ok"> · 완료</span>
                    )}
                  </span>
                </div>
                <div className="journal-progress-track journal-progress-track--week">
                  <div
                    className={`journal-progress-fill${stats.shortage > 0.001 ? ' warn' : ''}`}
                    style={{ width: `${stats.pct.toFixed(1)}%` }}
                  />
                </div>
              </div>
              {!tableHidden && (
              <div className="journal-week-table-wrap" id={`journal-week-table-${week.key}`}>
                <table className="journal-week-table">
                  <colgroup>
                    <col className="col-name" />
                    {week.days.map((d) => (
                      <col key={dateKey(d.getFullYear(), d.getMonth(), d.getDate())} className="col-day" />
                    ))}
                    <col className="col-summary" />
                    <col className="col-next" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="col-name">구분</th>
                      {['월', '화', '수', '목', '금'].map((name, i) => (
                        <th key={name} className="col-day">
                          {name}
                          <br />
                          <small style={{ fontWeight: 400, opacity: 0.7 }}>
                            {week.days[i].getMonth() + 1}/{week.days[i].getDate()}
                          </small>
                        </th>
                      ))}
                      <th className="col-summary">금주(요약)</th>
                      <th className="col-next">차주(예정)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="journal-week-member-name">
                        <strong>{selectedMember.displayName}</strong>
                        <span className="journal-week-member-role">{formatKpiMemberRoleLine(selectedMember)}</span>
                      </td>
                      {week.days.map((d) => renderDayCell(d))}
                      <td className="journal-week-notes-cell col-summary">
                        <div className="journal-week-notes-inner">
                          <div className="journal-week-notes-head">
                            <span className="journal-week-notes-tag">금주(요약)</span>
                            {!journalReadOnly && (
                              <button
                                type="button"
                                className="journal-summary-draft-btn"
                                onClick={() => {
                                  journal.applyWeekColumnTemplate(week.key, 'summary', memberCode);
                                  showToast(`${week.index}주 금주(요약) 기본 양식 적용`);
                                }}
                              >
                                기본 양식
                              </button>
                            )}
                          </div>
                          <JournalWeekColumnTextarea
                            readOnly={journalReadOnly}
                            value={journal.getWeekSummaryContent(week.key, memberCode)}
                            onChange={(text) => journal.setWeekSummary(week.key, text, memberCode)}
                            placeholder={journalReadOnly ? '' : '• 카테고리 아래에서 Enter → └ 하위 항목'}
                          />
                        </div>
                      </td>
                      <td className="journal-week-notes-cell col-next">
                        <div className="journal-week-notes-inner">
                          <div className="journal-week-notes-head">
                            <span className="journal-week-notes-tag">차주(예정)</span>
                            {!journalReadOnly && (
                              <button
                                type="button"
                                className="journal-summary-draft-btn"
                                onClick={() => {
                                  journal.applyWeekColumnTemplate(week.key, 'next', memberCode);
                                  showToast(`${week.index}주 차주(예정) 기본 양식 적용`);
                                }}
                              >
                                기본 양식
                              </button>
                            )}
                          </div>
                          <JournalWeekColumnTextarea
                            readOnly={journalReadOnly}
                            value={journal.getNextWeekContent(week.key, memberCode)}
                            onChange={(text) => journal.setNextWeekPlan(week.key, text, memberCode)}
                            placeholder={journalReadOnly ? '' : '• 카테고리 아래에서 Enter → └ 하위 항목'}
                          />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              )}
            </section>
          );
        })}
      </div>

        {showMemberKpiApproval && (
          <MemberKpiApprovalPanel
            year={year}
            month={month}
            memberCode={memberCode}
            memberLabel={formatKpiMemberLabel(selectedMember)}
            onToast={showToast}
            embedded
            dialogOpen={kpiApprovalModalOpen}
            onDialogClose={() => setKpiApprovalModalOpen(false)}
          />
        )}

      <div className={`journal-panel-overlay${panelOpen || addOpen || copyOpen || moveOpen || leaveOpen || memoOpen ? ' open' : ''}`} onClick={closeAll} role="presentation" />

      {memoOpen && memoTask && (
        <div className="modal-content journal-task-memo-modal" role="dialog" aria-modal="true" aria-labelledby="journal-task-memo-title">
          <div className="modal-header">
            <h3 id="journal-task-memo-title">업무 메모</h3>
            <button type="button" className="modal-close" onClick={closeTaskMemo} aria-label="닫기">
              ×
            </button>
          </div>
          <div className="form-group">
            <p className="journal-field-help">
              「{memoTask.title}」 업무 처리 중 참고할 내용, 협의 사항, 이슈, 후속 조치 등을 기록하세요.
            </p>
            <textarea
              className="form-input"
              rows={8}
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              placeholder="예: 회의 결과, 이슈, 확인 필요 사항, 후속 조치 등"
              readOnly={journalReadOnly}
              autoFocus
            />
          </div>
          {!journalReadOnly && (
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setMemoText('')}>
                메모 삭제
              </button>
              <button type="button" className="btn btn-secondary" onClick={closeTaskMemo}>
                닫기
              </button>
              <button type="button" className="btn btn-primary" onClick={saveTaskMemo}>
                저장
              </button>
            </div>
          )}
        </div>
      )}

      <aside className={`journal-side-panel${panelOpen ? ' open' : ''}`}>
        {editTask && (
          <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3>업무 항목 편집</h3>
            </div>
            <div style={{ padding: '1rem', flex: 1, overflowY: 'auto' }}>
              <div className="form-group">
                <label>카테고리</label>
                <select className="form-input" value={editTask.cat} onChange={(e) => setEditTask({ ...editTask, cat: e.target.value })} disabled={journalReadOnly}>
                  {memberCategoryView.order.map((k) => (
                    <option key={k} value={k}>
                      {memberCategoryView.cats[k]?.label ?? k}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>{KPI1_NAME} M/D 구분</label>
                <select
                  className="form-input"
                  value={getMmAxisSelectValue(editTask)}
                  onChange={(e) => setEditTask({ ...editTask, mmAxis: e.target.value })}
                  disabled={journalReadOnly}
                  aria-describedby="journal-mm-axis-help"
                >
                  <option value="work">업무 M/D</option>
                  <option value="improve">생산향상 M/D</option>
                </select>
                <p id="journal-mm-axis-help" className="journal-field-help">
                  업무 M/D는 실제 투입 시간, 생산향상 M/D는 개선·자동화 업무 시간입니다.
                </p>
              </div>
              <div className="form-group">
                <label>시간대</label>
                <div className="journal-slot-options" role="group" aria-label="시간대">
                  {JOURNAL_TASK_SLOTS.map(({ value, label }) => (
                    <label key={value || 'any'} className="journal-slot-option">
                      <input
                        type="radio"
                        name="edit-task-slot"
                        value={value}
                        checked={normalizeTaskSlot(editTask.slot) === value}
                        onChange={() => setEditTask({ ...editTask, slot: value || undefined })}
                        disabled={journalReadOnly}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="journal-edit-task-title">업무명</label>
                <JournalTaskTitleCombobox
                  id="journal-edit-task-title"
                  value={editTask.title}
                  titles={knownTaskTitles}
                  readOnly={journalReadOnly}
                  onChange={(title) => setEditTask({ ...editTask, title })}
                />
              </div>
              <JournalEditKpiPreview task={editTask} dayKey={editTask.dayKey} improveProjects={journal.improveProjects} />
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(editTask.kpi2Effect?.enabled)}
                    onChange={(e) =>
                      setEditTask({
                        ...editTask,
                        kpi2Effect: e.target.checked
                          ? {
                              enabled: true,
                              projectId: editTask.kpi2Effect?.projectId || journal.improveProjects[0]?.id || '',
                              baselineHours: editTask.kpi2Effect?.baselineHours ?? editTask.plan ?? 0,
                            }
                          : undefined,
                      })
                    }
                    disabled={journalReadOnly}
                  />{' '}
                  {KPI2_NAME} 효과 건 (도구 활용·시간 단축)
                </label>
                <p className="journal-field-help">개선 효과로 제출할 항목만 체크합니다.</p>
              </div>
              {editTask.kpi2Effect?.enabled && (
                <>
                  <div className="form-group">
                    <label>향상 과제</label>
                    <select
                      className="form-input"
                      value={editTask.kpi2Effect.projectId || ''}
                      onChange={(e) =>
                        setEditTask({
                          ...editTask,
                          kpi2Effect: { ...editTask.kpi2Effect, projectId: e.target.value },
                        })
                      }
                      disabled={journalReadOnly}
                    >
                      <option value="">선택</option>
                      {journal.improveProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>기준시간 (h, 도구 없을 때)</label>
                    <input
                      type="number"
                      step="0.5"
                      className="form-input"
                      value={editTask.kpi2Effect.baselineHours ?? ''}
                      onChange={(e) =>
                        setEditTask({
                          ...editTask,
                          kpi2Effect: { ...editTask.kpi2Effect, baselineHours: e.target.value },
                        })
                      }
                      readOnly={journalReadOnly}
                    />
                  </div>
                </>
              )}
              <div className="form-group">
                <label>계획 (h)</label>
                <input type="number" step="0.5" className="form-input" value={editTask.plan} onChange={(e) => setEditTask({ ...editTask, plan: e.target.value })} readOnly={journalReadOnly} />
              </div>
              <div className="form-group">
                <label>실작업 (h)</label>
                <input type="number" step="0.5" className="form-input" value={editTask.actual} onChange={(e) => setEditTask({ ...editTask, actual: e.target.value })} readOnly={journalReadOnly} />
              </div>
              <label>
                <input type="checkbox" checked={editTask.done} onChange={(e) => setEditTask({ ...editTask, done: e.target.checked })} disabled={journalReadOnly} /> 완료
              </label>
              <p className="journal-field-help">완료 체크한 업무의 실작업(h)만 M/D·가동률에 반영됩니다.</p>
            </div>
            {!journalReadOnly && (
              <div className="modal-actions journal-edit-actions">
                <div className="journal-edit-actions-danger">
                  <button type="button" className="btn btn-secondary" onClick={deleteTask}>
                    삭제
                  </button>
                  <button type="button" className="btn btn-secondary journal-copy-btn" onClick={openCopyModal}>
                    <Copy size={14} aria-hidden />
                    복사
                  </button>
                  <button type="button" className="btn btn-secondary journal-copy-btn" onClick={openMoveModal}>
                    <ArrowRightLeft size={14} aria-hidden />
                    이동
                  </button>
                </div>
                <div className="journal-edit-actions-primary">
                  <button type="button" className="btn btn-secondary" onClick={closeAll}>
                    취소
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    title="선택 항목을 저장합니다"
                    aria-label="저장"
                  >
                    저장
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </aside>

      <div className={`journal-modal${addOpen ? ' open' : ''}`}>
        <h3 style={{ padding: '1rem' }}>업무 추가</h3>
        <div style={{ padding: '0 1rem 1rem' }}>
          <div className="form-group">
            <label>카테고리</label>
            <select className="form-input" value={addDraft.cat} onChange={(e) => setAddDraft({ ...addDraft, cat: e.target.value })}>
              {memberCategoryView.order.map((k) => (
                <option key={k} value={k}>
                  {memberCategoryView.cats[k]?.label ?? k}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>시간대</label>
            <div className="journal-slot-options" role="group" aria-label="시간대">
              {JOURNAL_TASK_SLOTS.map(({ value, label }) => (
                <label key={value || 'any'} className="journal-slot-option">
                  <input
                    type="radio"
                    name="add-task-slot"
                    value={value}
                    checked={normalizeTaskSlot(addDraft.slot) === value}
                    onChange={() => setAddDraft({ ...addDraft, slot: value })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="journal-add-task-title">업무명</label>
            <JournalTaskTitleCombobox
              id="journal-add-task-title"
              value={addDraft.title}
              titles={knownTaskTitles}
              placeholder="입력하거나 이전 업무명 선택"
              onChange={(title) => setAddDraft({ ...addDraft, title })}
            />
          </div>
          <div className="form-group">
            <label>계획 (h)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              className="form-input"
              value={addDraft.plan}
              onChange={(e) => setAddDraft({ ...addDraft, plan: e.target.value })}
            />
          </div>
          <p className="journal-add-hint">추가 후 편집 화면에서 실작업(h)를 입력합니다.</p>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={closeAll}>
            취소
          </button>
          <button type="button" className="btn btn-primary" onClick={confirmAdd}>
            추가
          </button>
        </div>
      </div>

      <div className={`journal-modal${copyOpen ? ' open' : ''}`}>
        <h3 style={{ padding: '1rem' }}>업무 복사</h3>
        <div style={{ padding: '0 1rem 1rem' }}>
          {editTask && (
            <p className="journal-copy-source">
              「{editTask.title}」을 아래 날짜에 복사합니다. 복사본은 실작업 0·미완료로 추가됩니다.
            </p>
          )}
          <div className="form-group">
            <label htmlFor="journal-copy-date">붙일 날짜</label>
            <input
              id="journal-copy-date"
              type="date"
              className="form-input journal-copy-date"
              value={copyTargetDayKey}
              onChange={(e) => setCopyTargetDayKey(e.target.value)}
            />
          </div>
          {copyTargetDayKey && (
            <p className="journal-add-hint">{formatDayLabel(copyTargetDayKey)}</p>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setCopyOpen(false)}>
            취소
          </button>
          <button type="button" className="btn btn-primary" onClick={confirmCopy} disabled={!copyTargetDayKey}>
            복사
          </button>
        </div>
      </div>

      <div className={`journal-modal${moveOpen ? ' open' : ''}`}>
        <h3 style={{ padding: '1rem' }}>업무 이동</h3>
        <div style={{ padding: '0 1rem 1rem' }}>
          {editTask && (
            <p className="journal-copy-source">
              「{editTask.title}」을 아래 날짜로 옮깁니다. 원래 날짜에서는 제거되며, 계획·실작업·완료 상태는 그대로 유지됩니다.
            </p>
          )}
          <div className="form-group">
            <label htmlFor="journal-move-date">이동할 날짜</label>
            <input
              id="journal-move-date"
              type="date"
              className="form-input journal-copy-date"
              value={moveTargetDayKey}
              onChange={(e) => setMoveTargetDayKey(e.target.value)}
            />
          </div>
          {moveTargetDayKey && (
            <p className="journal-add-hint">
              {formatDayLabel(moveTargetDayKey)}
              {editTask && moveTargetDayKey === editTask.dayKey ? ' · 현재 날짜와 같습니다' : ''}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setMoveOpen(false)}>
            취소
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={confirmMove}
            disabled={!moveTargetDayKey || (editTask && moveTargetDayKey === editTask.dayKey)}
          >
            이동
          </button>
        </div>
      </div>

      <div className={`journal-modal${leaveOpen ? ' open' : ''}`}>
        <h3 style={{ padding: '1rem' }}>휴일 M/D</h3>
        <p style={{ padding: '0 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{leaveDayKey && formatDayLabel(leaveDayKey)}</p>
        {leavePreview && (
          <p style={{ padding: '0 1rem', fontSize: '0.85rem' }}>
            업무 {leavePreview.work} · 향상 {leavePreview.improve} (자동)
          </p>
        )}
        <div className="journal-leave-presets">
          {LEAVE_PRESET_BUTTONS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`btn btn-secondary journal-leave-preset-btn${p.group === 'clear' ? ' is-clear' : ''}`}
              onClick={() => applyLeavePreset(p.id)}
              disabled={journalReadOnly}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="journal-leave-preset-hint">
          연차·외근·출장·공휴 1일 = 휴일 M/D 1.0 + 메모 항목. 오전반차·오후반차는 0.5(4h), 반반차는 0.25(2h)입니다. 실무 외근은 「+ 항목」에 실작업(h) 입력.
        </p>
        <div className="form-group" style={{ padding: '0 1rem' }}>
          <label>휴일 M/D</label>
          <input type="number" step="0.25" className="form-input" value={leaveLeave} onChange={(e) => setLeaveLeave(e.target.value)} readOnly={journalReadOnly} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={closeAll}>
            취소
          </button>
          <button type="button" className="btn btn-primary" onClick={saveLeave} disabled={journalReadOnly}>
            적용
          </button>
        </div>
      </div>

      {toast && (
        <div className="journal-toast" role="status">
          {toast}
        </div>
      )}

      {shareImportChoiceOpen && (
        <div className="modal-overlay active" role="presentation" onClick={() => setShareImportChoiceOpen(false)}>
          <div
            className="modal-card journal-share-choice-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="journal-share-choice-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-card__header">
              <div>
                <p className="eyebrow">팀 공유본 가져오기</p>
                <h3 id="journal-share-choice-title">가져올 범위 선택</h3>
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label="닫기"
                onClick={() => setShareImportChoiceOpen(false)}
              >
                ×
              </button>
            </header>
            <p className="journal-share-choice-modal__lead">
              본인 작성 내용은 유지하려면 「타 구성원 것만 가져오기」를 선택하세요.
            </p>
            <div className="journal-share-choice-modal__actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  setShareImportChoiceOpen(false);
                  try {
                    const r = await journal.pullFromCloud({
                      ...memberTeamSharePullOpts,
                      includeOwnMember: true,
                    });
                    showToast(journalPullToastMessage(r));
                  } catch (e) {
                    showToast(e.message);
                  }
                }}
              >
                본인 것 포함해서 가져오기
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={async () => {
                  setShareImportChoiceOpen(false);
                  try {
                    const r = await journal.pullFromCloud({
                      ...memberTeamSharePullOpts,
                      includeOwnMember: false,
                    });
                    showToast(journalPullToastMessage(r));
                  } catch (e) {
                    showToast(e.message);
                  }
                }}
              >
                타 구성원 것만 가져오기
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShareImportChoiceOpen(false)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      <JournalMemberPrefsModal
        open={memberPrefsOpen}
        onClose={() => setMemberPrefsOpen(false)}
        memberLabel={formatKpiMemberLabel(selectedMember)}
        prefs={journal.getMemberPrefs(memberCode)}
        onSave={(next) => {
          journal.setMemberPrefs(next, memberCode);
          showToast(`${formatKpiMemberLabel(selectedMember)} 범례·기본 양식 저장`);
        }}
      />

      {showMemberImproveProjectsToolbar && (
        <MemberImproveProjectsDialog
          open={improveProjectsModalOpen}
          onClose={() => setImproveProjectsModalOpen(false)}
          projects={memberOwnedImproveProjects}
          shareBusy={journal.improveProjectsApi.sharedBusy}
          onPullShare={async () => {
            const pullCode = teamAccess.scopedMember || memberCode;
            const r = await journal.improveProjectsApi.loadSharedProjects({
              memberCode: pullCode,
            });
            if (r.ok) {
              showToast(`본인 향상 과제 ${r.importedCount}건을 반영했습니다`);
            } else if (r.reason === 'no-member-projects') {
              showToast(
                '팀 공유본에 본인 담당 과제가 없습니다. 팀장 운영 목록 등록·공유 저장을 확인하세요.'
              );
            } else if (r.reason === 'no-remote') showToast('팀 공유본이 아직 없습니다');
            else showToast(r.message || '팀 공유본을 가져오지 못했습니다');
          }}
        />
      )}
    </main>
  );
}
