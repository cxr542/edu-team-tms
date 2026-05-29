import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, RefreshCw, Target, Upload } from 'lucide-react';
import { JOURNAL_CATS } from '../constants/journalCategories';
import { useWeeklyJournal } from '../hooks/useWeeklyJournal';
import {
  dateKey,
  getDayHoursInfo,
  getTaskMmAxis,
  getWeekMmStats,
  getWeeksInMonth,
  hoursToMm,
  recalcDayMmFromHours,
} from '../utils/journalMm';
import { exportKpiJournalWorkbook } from '../utils/kpiExcelExport';
import { downloadJournalSnapshot } from '../utils/journalSnapshot';
import { resolveJournalDay } from '../utils/journalHoliday2026';
import { applyLeavePresetToDay, LEAVE_MEMO_TASK_RE, LEAVE_PRESET_BUTTONS } from '../utils/journalLeavePresets';
import { scheduleScrollJournalDay } from '../utils/journalScroll';
import { loadCollapsedWeekKeys, saveCollapsedWeekKeys } from '../utils/journalWeekVisibility';
import { KPI_JOURNAL_MEMBER } from '../constants/kpiSchema';
import JournalWeekColumnTextarea from '../components/JournalWeekColumnTextarea';
import './WeeklyJournalPage.css';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function formatDayLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${y}년 ${m}월 ${d}일 (${DAY_NAMES[dt.getDay()]})`;
}

function TaskMmPill({ task }) {
  if (LEAVE_MEMO_TASK_RE.test(task.title)) return null;
  const h = Number(task.actual) || 0;
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

export default function WeeklyJournalPage({ readOnly = false }) {
  const journal = useWeeklyJournal({ readOnly, autoSyncCloud: !readOnly });
  const importInputRef = useRef(null);
  const journalMainRef = useRef(null);
  const scrollToDayRef = useRef(null);
  const todayInit = getTodayParts();
  const [year, setYear] = useState(todayInit.year);
  const [month, setMonth] = useState(todayInit.month);
  const [selectedDayKey, setSelectedDayKey] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [addDayKey, setAddDayKey] = useState(null);
  const [leaveDayKey, setLeaveDayKey] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [collapsedWeeks, setCollapsedWeeks] = useState(() => loadCollapsedWeekKeys(year, month));

  useEffect(() => {
    setCollapsedWeeks(loadCollapsedWeekKeys(year, month));
  }, [year, month]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const getDay = useCallback(
    (key) => resolveJournalDay(key, journal.days[key]),
    [journal.days]
  );

  const weeks = useMemo(() => getWeeksInMonth(year, month), [year, month]);

  const persistCollapsedWeeks = useCallback(
    (next) => {
      setCollapsedWeeks(next);
      saveCollapsedWeekKeys(year, month, next);
    },
    [year, month]
  );

  const toggleWeekTable = useCallback(
    (weekKey) => {
      setCollapsedWeeks((prev) => {
        const next = new Set(prev);
        if (next.has(weekKey)) next.delete(weekKey);
        else next.add(weekKey);
        saveCollapsedWeekKeys(year, month, next);
        return next;
      });
    },
    [year, month]
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
    return { work, improve, leave, shortDays, doneTasks };
  }, [weeks, getDay]);

  const openPresetLeave = () => {
    const key =
      selectedDayKey || dateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    openLeave(key);
  };

  const changeMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    if (m > 11) {
      m = 0;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  const [scrollTick, setScrollTick] = useState(0);

  const goToToday = useCallback(() => {
    const { year: y, month: m, key } = getTodayParts();
    scrollToDayRef.current = key;
    setYear(y);
    setMonth(m);
    setSelectedDayKey(key);
    setScrollTick((t) => t + 1);
    showToast(`${formatDayLabel(key)} — 오늘 입력 셀로 이동`);
  }, []);

  useEffect(() => {
    const key = scrollToDayRef.current;
    if (!key) return;

    return scheduleScrollJournalDay(key, journalMainRef.current, {
      onSuccess: () => {
        scrollToDayRef.current = null;
      },
    });
  }, [scrollTick]);

  const openEdit = (taskId, dayKey) => {
    const day = getDay(dayKey);
    const task = day.tasks.find((t) => t.id === taskId);
    if (!task) return;
    setEditTask({ ...task, dayKey });
    setPanelOpen(true);
  };

  const saveEdit = (e) => {
    e.preventDefault();
    if (!editTask || readOnly) return;
    journal.updateDay(editTask.dayKey, (day) => {
      const tasks = day.tasks.map((t) =>
        t.id === editTask.id
          ? {
              ...t,
              cat: editTask.cat,
              title: editTask.title,
              note: editTask.note,
              plan: Number(editTask.plan) || 0,
              actual: Number(editTask.actual) || 0,
              done: editTask.done,
              mmAxis: editTask.mmAxis || undefined,
            }
          : t
      );
      const next = { ...day, tasks };
      recalcDayMmFromHours(next);
      return next;
    });
    closeAll();
    showToast('저장됨');
  };

  const deleteTask = () => {
    if (!editTask || readOnly) return;
    journal.updateDay(editTask.dayKey, (day) => {
      const next = { ...day, tasks: day.tasks.filter((t) => t.id !== editTask.id) };
      recalcDayMmFromHours(next);
      return next;
    });
    closeAll();
    showToast('삭제됨');
  };

  const [addDraft, setAddDraft] = useState({
    cat: 'edu',
    title: '',
    plan: 4,
    actual: 3.5,
    done: true,
  });

  const confirmAdd = () => {
    if (!addDayKey || readOnly) return;
    if (!addDraft.title.trim()) {
      showToast('업무명을 입력하세요');
      return;
    }
    journal.updateDay(addDayKey, (day) => {
      const next = {
        ...day,
        tasks: [
          ...day.tasks,
          {
            id: `t-${Date.now()}`,
            cat: addDraft.cat,
            title: addDraft.title.trim(),
            plan: Number(addDraft.plan) || 0,
            actual: Number(addDraft.actual) || 0,
            done: addDraft.done,
            note: '',
          },
        ],
      };
      recalcDayMmFromHours(next);
      return next;
    });
    closeAll();
    showToast('항목 추가됨');
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
    if (!leaveDayKey || readOnly) return;
    journal.updateDay(leaveDayKey, (day) => {
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
    if (!leaveDayKey || readOnly) return;
    const leave = Number(leaveLeave) || 0;
    journal.updateDay(leaveDayKey, (day) => {
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
    const readOnlyCls = readOnly ? ' journal-readonly' : '';

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
        className={`journal-day-cell${selectedDayKey === key ? ' is-selected' : ''}${isToday ? ' is-today' : ''}${hoursInfo.show && hoursInfo.isShort ? ' is-hours-short' : ''}${readOnlyCls}`}
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
            (hoursInfo.isShort ? (
              <span className="hours-badge short" title={`목표 ${hoursInfo.expected}h`}>
                ⚠ {hoursInfo.total}h
              </span>
            ) : (
              <span className="hours-badge ok">✓ {hoursInfo.total}h</span>
            ))}
        </div>
        {data.holiday && <div style={{ color: 'var(--accent)', fontSize: '0.75rem' }}>공휴일</div>}
        <ul className="journal-task-list">
          {data.tasks.map((t) => (
            <li
              key={t.id}
              className={`journal-task-item${editTask?.id === t.id ? ' selected' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!readOnly) openEdit(t.id, key);
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: JOURNAL_CATS[t.cat].color, flexShrink: 0, marginTop: 5 }} />
              <span style={{ flex: 1 }}>
                {t.title}
                {(t.plan || t.actual) && (
                  <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                    {t.plan}h → {t.actual}h
                  </small>
                )}
              </span>
              <TaskMmPill task={t} />
              {t.done && <span style={{ color: '#6ee7b7' }}>✓</span>}
            </li>
          ))}
        </ul>
        <div className="journal-mm-row">
          <button type="button" className={`journal-mm-chip${data.mm.leave > 0 ? ' leave-active' : ''}`} onClick={(e) => { e.stopPropagation(); if (!readOnly) openLeave(key); }}>
            업무 {data.mm.work}
          </button>
          <button type="button" className="journal-mm-chip" onClick={(e) => { e.stopPropagation(); if (!readOnly) openLeave(key); }}>
            향상 {data.mm.improve}
          </button>
          <button type="button" className={`journal-mm-chip${data.mm.leave > 0 ? ' leave-active' : ''}`} onClick={(e) => { e.stopPropagation(); if (!readOnly) openLeave(key); }}>
            휴일 {data.mm.leave}
          </button>
        </div>
        {!readOnly && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '0.25rem 0.4rem' }} onClick={(e) => { e.stopPropagation(); setAddDayKey(key); setAddOpen(true); }}>
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
              <button type="button" className="journal-icon-btn" onClick={() => changeMonth(-1)} aria-label="이전 달">
                <ChevronLeft size={18} />
              </button>
              <h1>
                {year}년 {month + 1}월
              </h1>
              <button type="button" className="journal-icon-btn" onClick={() => changeMonth(1)} aria-label="다음 달">
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="journal-author-chip">
              작성자 <strong>{KPI_JOURNAL_MEMBER.displayName}</strong>{' '}
              <span>
                ({KPI_JOURNAL_MEMBER.code} · 강사){readOnly ? ' · 조회' : ''}
              </span>
            </div>
            <div className="journal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  try {
                    const result = exportKpiJournalWorkbook({
                      year,
                      monthIndex: month,
                      days: journal.days,
                      weekSummaries: journal.weekSummaries,
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
              <button type="button" className="btn btn-secondary" onClick={goToToday}>
                <Target size={16} />
                오늘로 이동
              </button>
              {!readOnly && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={async () => {
                      try {
                        let r = await journal.pullFromCloud();
                        if (r.reason === 'local-newer') {
                          if (
                            window.confirm(
                              '이 기기 일지가 더 최신입니다. 클라우드 백업으로 덮어쓸까요?'
                            )
                          ) {
                            r = await journal.pullFromCloud({ force: true });
                          }
                        }
                        if (r.ok) showToast('클라우드 일지를 이 기기에 반영했습니다');
                        else if (r.reason === 'local-newer') showToast('동기화를 취소했습니다');
                        else if (r.reason === 'cancelled') showToast('동기화를 취소했습니다');
                        else if (r.reason === 'no-remote') showToast('클라우드 백업이 없습니다 — 먼저 게시·배포 필요');
                      } catch (e) {
                        showToast(e.message);
                      }
                    }}
                  >
                    <RefreshCw size={16} />
                    클라우드 맞추기
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      downloadJournalSnapshot(journal.getStore());
                      showToast('journal-snapshot.json 저장 → npm run publish:journal 후 deploy');
                    }}
                  >
                    <Upload size={16} />
                    클라우드에 게시
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => importInputRef.current?.click()}>
                    <Upload size={16} />
                    백업 가져오기
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={openPresetLeave}>
                    휴일 프리셋
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
                        await journal.importFromFile(file);
                        showToast('백업 파일을 반영했습니다');
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

          {!readOnly && journal.meta?.updatedAt && (
            <p className="journal-sync-hint">
              이 기기 저장: {new Date(journal.meta.updatedAt).toLocaleString('ko-KR')}
              {journal.syncStatus === 'synced' && ' · 클라우드와 맞춤'}
            </p>
          )}

          <div className="journal-kpi-strip">
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
              KPI2 완료 업무
              <strong>{kpiMonth.doneTasks}건</strong>
            </div>
            <div>
              8h 미만 근무일
              <strong className={kpiMonth.shortDays ? 'is-warn' : ''}>{kpiMonth.shortDays}일</strong>
            </div>
          </div>

          <div className="journal-mm-panel">
            <div className="journal-mm-panel-head">
              <h2>월 M/M 입력 현황 (KPI1)</h2>
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

          {weeks.length > 0 && (
            <div className="journal-week-visibility-bar">
              <span className="journal-week-visibility-label">
                주차별 표
                {hiddenWeekCount > 0 ? (
                  <span className="journal-week-visibility-count"> · {hiddenWeekCount}주 숨김</span>
                ) : null}
              </span>
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
        </div>

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
                      <td style={{ fontWeight: 700, textAlign: 'center' }}>김윤형</td>
                      {week.days.map((d) => renderDayCell(d))}
                      <td className="journal-week-notes-cell col-summary">
                        <div className="journal-week-notes-inner">
                          <div className="journal-week-notes-head">
                            <span className="journal-week-notes-tag">금주(요약)</span>
                            {!readOnly && (
                              <button
                                type="button"
                                className="journal-summary-draft-btn"
                                onClick={() => {
                                  journal.applyWeekColumnTemplate(week.key, 'summary');
                                  showToast(`${week.index}주 금주(요약) 기본 양식 적용`);
                                }}
                              >
                                기본 양식
                              </button>
                            )}
                          </div>
                          <JournalWeekColumnTextarea
                            readOnly={readOnly}
                            value={journal.getWeekSummaryContent(week.key)}
                            onChange={(text) => journal.setWeekSummary(week.key, text)}
                            placeholder={readOnly ? '' : '• 카테고리 아래에서 Enter → └ 하위 항목'}
                          />
                        </div>
                      </td>
                      <td className="journal-week-notes-cell col-next">
                        <div className="journal-week-notes-inner">
                          <div className="journal-week-notes-head">
                            <span className="journal-week-notes-tag">차주(예정)</span>
                            {!readOnly && (
                              <button
                                type="button"
                                className="journal-summary-draft-btn"
                                onClick={() => {
                                  journal.applyWeekColumnTemplate(week.key, 'next');
                                  showToast(`${week.index}주 차주(예정) 기본 양식 적용`);
                                }}
                              >
                                기본 양식
                              </button>
                            )}
                          </div>
                          <JournalWeekColumnTextarea
                            readOnly={readOnly}
                            value={journal.getNextWeekContent(week.key)}
                            onChange={(text) => journal.setNextWeekPlan(week.key, text)}
                            placeholder={readOnly ? '' : '• 카테고리 아래에서 Enter → └ 하위 항목'}
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

      <div className={`journal-panel-overlay${panelOpen || addOpen || leaveOpen ? ' open' : ''}`} onClick={closeAll} role="presentation" />

      <aside className={`journal-side-panel${panelOpen ? ' open' : ''}`}>
        {editTask && (
          <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3>업무 항목 편집</h3>
            </div>
            <div style={{ padding: '1rem', flex: 1, overflowY: 'auto' }}>
              <div className="form-group">
                <label>카테고리</label>
                <select className="form-input" value={editTask.cat} onChange={(e) => setEditTask({ ...editTask, cat: e.target.value })} disabled={readOnly}>
                  {Object.entries(JOURNAL_CATS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>KPI1 M/M 구분</label>
                <select
                  className="form-input"
                  value={editTask.mmAxis || ''}
                  onChange={(e) => setEditTask({ ...editTask, mmAxis: e.target.value || undefined })}
                  disabled={readOnly}
                >
                  <option value="">자동 (AI→향상)</option>
                  <option value="work">업무 M/M</option>
                  <option value="improve">생산향상 M/M</option>
                </select>
              </div>
              <div className="form-group">
                <label>업무명</label>
                <input className="form-input" value={editTask.title} onChange={(e) => setEditTask({ ...editTask, title: e.target.value })} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>계획 (h)</label>
                <input type="number" step="0.5" className="form-input" value={editTask.plan} onChange={(e) => setEditTask({ ...editTask, plan: e.target.value })} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>실작업 (h)</label>
                <input type="number" step="0.5" className="form-input" value={editTask.actual} onChange={(e) => setEditTask({ ...editTask, actual: e.target.value })} readOnly={readOnly} />
              </div>
              <label>
                <input type="checkbox" checked={editTask.done} onChange={(e) => setEditTask({ ...editTask, done: e.target.checked })} disabled={readOnly} /> 완료
              </label>
            </div>
            {!readOnly && (
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={deleteTask}>
                  삭제
                </button>
                <button type="submit" className="btn btn-primary">
                  저장
                </button>
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
              {Object.entries(JOURNAL_CATS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>업무명</label>
            <input className="form-input" value={addDraft.title} onChange={(e) => setAddDraft({ ...addDraft, title: e.target.value })} />
          </div>
          <div className="form-group">
            <label>실작업 (h)</label>
            <input type="number" step="0.5" className="form-input" value={addDraft.actual} onChange={(e) => setAddDraft({ ...addDraft, actual: e.target.value })} />
          </div>
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
              disabled={readOnly}
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
          <input type="number" step="0.25" className="form-input" value={leaveLeave} onChange={(e) => setLeaveLeave(e.target.value)} readOnly={readOnly} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={closeAll}>
            취소
          </button>
          <button type="button" className="btn btn-primary" onClick={saveLeave} disabled={readOnly}>
            적용
          </button>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#17243c', padding: '0.65rem 1.25rem', borderRadius: 8, zIndex: 200, border: '1px solid var(--border-color)' }}>
          {toast}
        </div>
      )}
    </main>
  );
}
