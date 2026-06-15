import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Import,
  Copy,
  Download,
  RefreshCw,
  RotateCcw,
  Target,
  Upload,
} from 'lucide-react';
import { resolveMemberCategories } from '../utils/journalMemberPrefs';
import { useJournal } from '../context/JournalProvider';
import { useJournalPeriod } from '../hooks/useJournalPeriod';
import {
  dateKey,
  getDayHoursInfo,
  getTaskLoggedHours,
  getTaskMmAxis,
  getWeekMmStats,
  getWeeksInMonth,
  hoursToMm,
  recalcDayMmFromHours,
} from '../utils/journalMm';
import { exportKpiAnalysisWorkbook } from '../utils/kpiExcelExport';
import { countKpi2EffectTasks } from '../utils/computeTeamKpi';
import { formatPublishedAt } from '../utils/appMode';
import { getCloudHealthUserMessage } from '../utils/cloudHealth';
import { resolveJournalDay } from '../utils/journalHoliday2026';
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
import { URL_ACCESS_LEADER } from '../constants/teamAccess';
import { JournalEditKpiPreview, TaskKpiBadge } from '../components/JournalKpiLinkagePanel';
import JournalCategoryLegend from '../components/JournalCategoryLegend';
import JournalMemberPrefsModal from '../components/JournalMemberPrefsModal';
import MemberKpiApprovalPanel from '../components/MemberKpiApprovalPanel';
import { isEditorMode } from '../utils/appMode';
import {
  filterImproveProjectsForMember,
  formatImproveProjectOwnerLine,
  IMPROVE_PROJECT_JOURNAL_SCOPE_NOTICE,
} from '../utils/improveProjectLink';
import {
  IMPROVE_PROJECTS_FILE_IMPORT_FAIL,
  IMPROVE_PROJECTS_FILE_IMPORT_SUCCESS,
} from '../utils/improveProjectsFileSnapshot';
import { SHOW_BC_JOURNAL_TEAM_SHARE_UI } from '../constants/improveProjectSharingConfig';
import {
  IMPROVE_PROJECT_BLOB_SHARE_ENABLED,
  IMPROVE_PROJECTS_JSON_IMPORT_LABEL_MEMBER,
  IMPROVE_PROJECTS_JSON_MEMBER_HINT,
} from '../constants/improveProjectsShare';
import './WeeklyJournalPage.css';

const MEMBER_IMPROVE_PROJECT_CODES = new Set(['B', 'C']);

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

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
    result.source === 'blob' ? '클라우드' : result.source === 'static' ? '백업 파일' : '공유 저장소';
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
  const improveProjectsFileInputRef = useRef(null);
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

  const memberCategoryView = useMemo(
    () => resolveMemberCategories(journal.memberJournals?.[memberCode]?.prefs),
    [journal.memberJournals, memberCode]
  );
  const isImproveProjectMember = MEMBER_IMPROVE_PROJECT_CODES.has(memberCode);
  const showImproveProjectPanel = !journalReadOnly && (teamAccess.isMemberScope || isImproveProjectMember);
  const showJournalTeamShareControls =
    !journalReadOnly && (SHOW_BC_JOURNAL_TEAM_SHARE_UI || !isImproveProjectMember);
  const linkableImproveProjects = useMemo(
    () => filterImproveProjectsForMember(journal.improveProjects, memberCode),
    [journal.improveProjects, memberCode]
  );

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
    setLeaveDayKey(null);
    setSelectedDayKey(null);
  }, [memberCode]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };
  const sharedSaveText = {
    saving: ' · 공유 저장 중',
    saved: ' · 공유 저장 완료',
    error: ' · 공유 저장 실패 — 이 브라우저에는 임시 저장됨',
  }[journal.cloudSaveStatus] || '';
  const cloudHealthMessage = getCloudHealthUserMessage();

  const memberDays = journal.getMemberDays(memberCode);

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
    let totalLogged = 0;
    weeks.forEach((week) => {
      const s = getWeekMmStats(week.days, month, getDay);
      totalAvail += s.available;
      totalLogged += s.logged;
    });
    const shortage = Math.max(0, totalAvail - totalLogged);
    const pct = totalAvail > 0 ? Math.min(100, (totalLogged / totalAvail) * 100) : 100;
    return { totalAvail, totalLogged, shortage, pct };
  }, [weeks, month, getDay]);

  const kpiMonth = useMemo(() => {
    let work = 0;
    let improve = 0;
    let leave = 0;
    let shortDays = 0;
    let doneTasks = 0;
    const seen = new Set();
    weeks.forEach((week) => {
      week.days.forEach((d) => {
        const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
        if (seen.has(key)) return;
        seen.add(key);
        const day = getDay(key);
        work += day.mm.work;
        improve += day.mm.improve;
        leave += day.mm.leave;
        doneTasks += (day.tasks || []).filter((t) => t.done).length;
        const info = getDayHoursInfo(day);
        if (info.show && info.isShort) shortDays += 1;
      });
    });
    return {
      work,
      improve,
      leave,
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

  const openPresetLeave = () => {
    const key =
      selectedDayKey || dateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    openLeave(key);
  };

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
    showToast('이 브라우저에 저장됨');
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
      mmAxis: editTask.mmAxis || undefined,
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
    patchDay(leaveDayKey, (day) => {
      const next = applyLeavePresetToDay(day, preset);
      if (!next) return day;
      recalcDayMmFromHours(next);
      return next;
    });
    const updated = getDay(leaveDayKey);
    setLeaveLeave(updated.mm.leave);
    const label = LEAVE_PRESET_BUTTONS.find((b) => b.id === preset)?.label;
    if (label) showToast(`${label} 적용됨`);
  };

  const saveLeave = () => {
    if (!leaveDayKey || journalReadOnly) return;
    const leave = Number(leaveLeave) || 0;
    patchDay(leaveDayKey, (day) => {
      if (leave >= 1) {
        return { ...day, holiday: true, mm: { work: 0, improve: 0, leave: 1 }, tasks: day.tasks };
      }
      const next = { ...day, holiday: false, mm: { ...day.mm, leave } };
      recalcDayMmFromHours(next);
      return next;
    });
    closeAll();
    showToast('휴일 M/M 적용됨');
  };

  const closeAll = () => {
    setPanelOpen(false);
    setAddOpen(false);
    setCopyOpen(false);
    setMoveOpen(false);
    setLeaveOpen(false);
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
              <span style={{ flex: 1 }}>
                <span className="journal-task-title-row">
                  {slotLabel && <span className={`journal-task-slot slot-${normalizeTaskSlot(t.slot)}`}>{slotLabel}</span>}
                  <span>{t.title}</span>
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
              <TaskKpiBadge task={t} dayKey={key} improveProjects={journal.improveProjects} />
              <TaskMmPill task={t} />
              {t.done && <span className="journal-task-done">✓</span>}
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
              {(teamAccess.isLeader || memberCode === teamAccess.scopedMember) && (
                <AppModuleLink
                  className="btn btn-secondary"
                  module="competency"
                  mode="edit"
                  member={teamAccess.isLeader && !teamAccess.isMemberScope ? memberCode : teamAccess.scopedMember || memberCode}
                  access={teamAccess.isLeader && !teamAccess.isMemberScope ? URL_ACCESS_LEADER : undefined}
                  year={year}
                  month={month + 1}
                  style={{ textDecoration: 'none' }}
                  {...uiTooltip('역량 평가 — 해당 구성원 평가 페이지')}
                >
                  역량 평가 →
                </AppModuleLink>
              )}
              {teamAccess.isLeader && (
                <AppModuleLink
                  className="btn btn-secondary"
                  module="kpi"
                  mode="edit"
                  access={URL_ACCESS_LEADER}
                  year={year}
                  month={month + 1}
                  style={{ textDecoration: 'none' }}
                  {...uiTooltip('팀 KPI 관리 (팀장)')}
                >
                  팀 KPI 관리 →
                </AppModuleLink>
              )}
              <button
                type="button"
                className="btn btn-primary"
                {...uiTooltip('KPI 분석 Excel 저장')}
                onClick={() => {
                  try {
                    const result = exportKpiAnalysisWorkbook({
                      year,
                      monthIndex: month,
                      days: journal.getMemberDays(memberCode),
                      kpiOperational: journal.kpiOperational,
                      improveProjects: journal.improveProjects,
                      memberCode,
                      kpiWeekMemos: journal.getMemberKpiWeekMemos(memberCode),
                    });
                    showToast(`KPI 엑셀 저장 — ${result.rows01c}주 · ${result.rows02}건`);
                  } catch (err) {
                    showToast(`보내기 실패: ${err.message}`);
                  }
                }}
              >
                <Download size={16} />
                KPI 엑셀보내기
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={goToToday}
                {...uiTooltip('오늘 날짜로 스크롤')}
              >
                <Target size={16} />
                오늘로 이동
              </button>
              {!journalReadOnly && (
                <>
                  {showJournalTeamShareControls && (
                    <>
                      <button
                        type="button"
                        className="btn btn-import-shared"
                        aria-label="팀 공유본 가져오기"
                        {...uiTooltip(
                          '팀 공유 일지를 수동으로 가져옵니다. 자동 동기화는 사용하지 않습니다.',
                          undefined,
                          { wrap: true }
                        )}
                        onClick={async () => {
                          try {
                            const r = await journal.pullFromCloud();
                            showToast(journalPullToastMessage(r));
                          } catch (e) {
                            showToast(e.message);
                          }
                        }}
                      >
                        <Import size={16} />
                        팀 공유본 가져오기
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        aria-label="팀 공유 저장"
                        {...uiTooltip(
                          '현재 구성원 일지를 팀 공유 저장소에 수동 업로드합니다. 자동 저장은 사용하지 않습니다.',
                          undefined,
                          { wrap: true }
                        )}
                        onClick={async () => {
                          const r = await journal.saveMemberToCloud(memberCode);
                          if (r.ok) showToast(`${memberCode} 일지를 팀 공유 저장소에 저장했습니다`);
                          else showToast(r.error?.message || '팀 공유 저장 실패 — 이 브라우저에는 임시 저장됨');
                        }}
                      >
                        <Upload size={16} />
                        팀 공유 저장
                      </button>
                    </>
                  )}
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
                  <button
                    type="button"
                    className="btn btn-ghost journal-reset-seed"
                    {...uiTooltip('5·6월 Academizer 샘플 (A·B·C)', undefined, { wrap: true })}
                    onClick={() => {
                      if (!journal.resetToSeed(memberCode)) return;
                      journal.seedAcademizerDemo?.();
                      setYear(2026);
                      setMonth(5);
                      showToast('샘플 로드됨 — 6월 일지·KPI2·KPI3 4요소');
                    }}
                  >
                    <RotateCcw size={16} />
                    샘플로 되돌리기
                  </button>
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
              {canImportViewOnlyJournalBackup && (
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

          {!journalReadOnly && (
            <section className="journal-status-panel" aria-label="선택 날짜 및 저장 상태">
              <h2 className="journal-status-panel__title">{formatJournalDayHeading(focusDayKey)}</h2>
              <p className="journal-status-panel__meta">
                {focusIsToday ? (
                  <span className="journal-status-panel__today">오늘 작성 중</span>
                ) : (
                  <span>선택한 날짜 · 표에서 날짜 셀을 눌러 변경</span>
                )}
                <span className="journal-status-panel__sep" aria-hidden="true">
                  ·
                </span>
                <span>{describeFocusDayTasks(focusDay.tasks)}</span>
              </p>
              <p className="journal-status-panel__save">
                {localSavedAtLabel ? (
                  <>로컬 저장됨 ({localSavedAtLabel})</>
                ) : (
                  <>저장은 이 브라우저에 먼저 반영됩니다.</>
                )}
              </p>
            </section>
          )}

          {!journalReadOnly && (
            <details className="journal-kpi-help">
              <summary>M/M · KPI2 효과 안내</summary>
              <ul>
                <li>
                  <strong>일반 업무 M/M</strong>: 실제 투입 시간을 기록합니다. (실작업 h ÷ 8)
                </li>
                <li>
                  <strong>생산성향상 M/M</strong>: 개선·자동화·효율화 성격의 업무 시간을 기록합니다.
                </li>
                <li>
                  <strong>{KPI2_NAME} 효과</strong>: 개선 효과로 제출할 항목만 체크합니다.
                </li>
                <li>
                  <strong>완료 체크</strong>: 체크한 업무의 실작업(h)만 M/M·가동률·일일 실작업 합계에 반영됩니다.
                </li>
              </ul>
            </details>
          )}

          {showImproveProjectPanel && (
            <section className="journal-improve-projects-panel" aria-label="운영 중인 생산성향상 과제">
              <h3 className="journal-improve-projects-panel__title">운영 중인 생산성향상 과제</h3>
              <p className="journal-field-help">
                팀장이 KPI2 운영 목록에 등록한 향상 과제입니다. 관련 업무를 작성할 때 과제를 선택해 연결할 수
                있습니다.
              </p>
              <p className="journal-sync-hint">{IMPROVE_PROJECT_JOURNAL_SCOPE_NOTICE}</p>
              <p className="journal-field-help">
                {IMPROVE_PROJECT_BLOB_SHARE_ENABLED
                  ? '팀 공유가 필요하면 팀 공유본을 수동으로 가져오세요.'
                  : IMPROVE_PROJECTS_JSON_MEMBER_HINT}
              </p>
              {IMPROVE_PROJECT_BLOB_SHARE_ENABLED && cloudHealthMessage && (
                <p className="journal-sync-hint journal-sync-hint--warn">{cloudHealthMessage}</p>
              )}
              <div className="journal-improve-projects-panel__actions">
                {IMPROVE_PROJECT_BLOB_SHARE_ENABLED && (
                  <button
                    type="button"
                    className="btn btn-import-shared"
                    disabled={journal.improveProjectsApi.sharedBusy}
                    aria-label="팀 공유본 가져오기"
                    title="수동 — 팀장이 공유 저장한 향상 과제 운영 목록을 가져옵니다"
                    {...uiTooltip(
                      '팀장이 공유 저장한 향상 과제 운영 목록을 수동으로 가져옵니다. 자동 동기화는 사용하지 않습니다.',
                      undefined,
                      { wrap: true }
                    )}
                    onClick={async () => {
                      const r = await journal.improveProjectsApi.loadSharedProjects();
                      if (r.ok) showToast(`팀 공유 향상 과제 ${r.snapshot?.projects?.length || 0}건을 병합했습니다`);
                      else if (r.reason === 'no-remote') showToast('팀 공유본이 아직 없습니다');
                      else showToast(r.message || '팀 공유본을 가져오지 못했습니다');
                    }}
                  >
                    <Import size={16} />
                    팀 공유본 가져오기
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={journal.improveProjectsApi.sharedBusy}
                  aria-label={IMPROVE_PROJECTS_JSON_IMPORT_LABEL_MEMBER}
                  title="팀장이 전달한 JSON 파일을 이 브라우저 운영 목록에 병합합니다"
                  {...uiTooltip(
                    '팀장에게 받은 JSON 파일을 수동으로 가져옵니다. 자동 동기화는 사용하지 않습니다.',
                    undefined,
                    { wrap: true }
                  )}
                  onClick={() => improveProjectsFileInputRef.current?.click()}
                >
                  <Import size={16} />
                  {IMPROVE_PROJECTS_JSON_IMPORT_LABEL_MEMBER}
                </button>
                <input
                  ref={improveProjectsFileInputRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const r = await journal.improveProjectsApi.importProjectsFromFile(file);
                    if (r.ok) showToast(IMPROVE_PROJECTS_FILE_IMPORT_SUCCESS);
                    else showToast(r.message || IMPROVE_PROJECTS_FILE_IMPORT_FAIL);
                    e.target.value = '';
                  }}
                />
              </div>
              {linkableImproveProjects.length === 0 ? (
                <p className="journal-improve-projects-panel__empty">
                  아직 연결 가능한 향상 과제가 없습니다. 생산성향상 M/M 업무를 작성하면 팀장 KPI 화면에서 후보로
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
              <strong>「조회용 JSON 가져오기」</strong>로 팀장이 보낸 백업 파일을 불러오세요.
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
              {IMPROVE_PROJECT_BLOB_SHARE_ENABLED ? (
                <>
                  팀 공유가 필요할 때만 「팀 공유 저장」·「팀 공유본 가져오기」를 사용하세요.{' '}
                  자동 공유 저장은 사용하지 않습니다.
                </>
              ) : (
                <>
                  향상 과제 공유는 「팀장에게 받은 JSON 가져오기」를 사용하세요.{' '}
                  자동 공유 저장은 사용하지 않습니다.
                </>
              )}
            </p>
          )}
        </div>

        <div className="journal-summary-blocks">
          <div className="journal-kpi-strip">
            <p className="journal-kpi-strip-member">
              {formatKpiMemberLabel(selectedMember)} · {month + 1}월 집계
            </p>
            <div className="journal-kpi-strip-grid">
            <div>
              업무 M/M ({month + 1}월)
              <strong>{kpiMonth.work.toFixed(2)}</strong>
            </div>
            <div>
              생산향상 M/M
              <strong>{kpiMonth.improve.toFixed(2)}</strong>
            </div>
            <div>
              휴일 M/M
              <strong>{kpiMonth.leave.toFixed(2)}</strong>
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

          {!journalReadOnly && isEditorMode() && (
            <MemberKpiApprovalPanel
              year={year}
              month={month}
              memberCode={memberCode}
              memberLabel={formatKpiMemberLabel(selectedMember)}
              onToast={showToast}
            />
          )}

          <div className="journal-mm-panel">
            <div className="journal-mm-panel-head">
              <h2>
                월 M/M 입력 현황 ({KPI1_NAME}) — {selectedMember.displayName}
              </h2>
              <div className="journal-mm-panel-meta">
                입력 <strong>{monthMm.totalLogged.toFixed(2)}</strong> / 가용 <strong>{monthMm.totalAvail.toFixed(2)}</strong>{' '}
                M/M
                {monthMm.shortage > 0.001 ? (
                  <span className="shortage"> · 부족 {monthMm.shortage.toFixed(2)} M/M</span>
                ) : (
                  <span className="ok"> · 월간 입력 완료</span>
                )}
              </div>
            </div>
            <div className="journal-progress-track journal-progress-track--month">
              <div
                className={`journal-progress-fill${monthMm.shortage > 0.001 ? ' warn' : ''}`}
                style={{ width: `${monthMm.pct.toFixed(1)}%` }}
              />
            </div>
            <p className="journal-mm-hint">실작업(h)÷8 자동 · 평일 가용 0.8125(점심 제외) · 실작업 목표 6.5h</p>
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
          const stats = getWeekMmStats(week.days, month, getDay);
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
                    입력 <strong>{stats.logged.toFixed(2)}</strong> / 가용 <strong>{stats.available.toFixed(2)}</strong> M/M
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

      <div className={`journal-panel-overlay${panelOpen || addOpen || copyOpen || moveOpen || leaveOpen ? ' open' : ''}`} onClick={closeAll} role="presentation" />

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
                <label>{KPI1_NAME} M/M 구분</label>
                <select
                  className="form-input"
                  value={editTask.mmAxis || ''}
                  onChange={(e) => setEditTask({ ...editTask, mmAxis: e.target.value || undefined })}
                  disabled={journalReadOnly}
                  aria-describedby="journal-mm-axis-help"
                >
                  <option value="">자동 (AI→향상)</option>
                  <option value="work">업무 M/M</option>
                  <option value="improve">생산향상 M/M</option>
                </select>
                <p id="journal-mm-axis-help" className="journal-field-help">
                  업무 M/M은 실제 투입 시간, 생산향상 M/M은 개선·자동화 업무 시간입니다.
                </p>
              </div>
              {showImproveProjectPanel && (
                <div className="form-group">
                  <label htmlFor="edit-improve-project-link">관련 향상 과제</label>
                  <select
                    id="edit-improve-project-link"
                    className="form-input"
                    value={editTask.improveProjectId || ''}
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) {
                        setEditTask({
                          ...editTask,
                          improveProjectId: undefined,
                          improveProjectTitle: undefined,
                        });
                        return;
                      }
                      const project =
                        linkableImproveProjects.find((p) => p.id === id) ||
                        journal.improveProjects.find((p) => p.id === id);
                      setEditTask({
                        ...editTask,
                        improveProjectId: id,
                        improveProjectTitle: project?.name || '',
                      });
                    }}
                    disabled={journalReadOnly}
                    aria-describedby="journal-improve-project-link-help"
                  >
                    <option value="">선택 안 함</option>
                    {linkableImproveProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <p id="journal-improve-project-link-help" className="journal-field-help">
                    생산성향상 M/M 또는 KPI2 효과 업무라면 관련 향상 과제를 선택하세요.
                  </p>
                </div>
              )}
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
                <label>업무명</label>
                <input className="form-input" value={editTask.title} onChange={(e) => setEditTask({ ...editTask, title: e.target.value })} readOnly={journalReadOnly} />
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
              <p className="journal-field-help">완료 체크한 업무의 실작업(h)만 M/M·가동률에 반영됩니다.</p>
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
                    title="선택 항목을 이 브라우저 localStorage에 저장합니다"
                    aria-label="이 브라우저에 저장"
                  >
                    이 브라우저에 저장
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
            <label>업무명</label>
            <input className="form-input" value={addDraft.title} onChange={(e) => setAddDraft({ ...addDraft, title: e.target.value })} />
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
        <h3 style={{ padding: '1rem' }}>휴일 M/M</h3>
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
          연차·외근·출장 1일 = 휴일 M/M 1.0 + 메모 항목. 실무 외근은 「+ 항목」에 실작업(h) 입력.
        </p>
        <div className="form-group" style={{ padding: '0 1rem' }}>
          <label>휴일 M/M</label>
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
    </main>
  );
}
