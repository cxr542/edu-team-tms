import React, { useEffect, useRef, useState } from 'react';
import {
  AUTOMATION_GROUPS,
  AUTOMATION_WHERE,
  listAutomationRoutines,
} from '../constants/automationRoutines';
import { fetchReleaseNoteCheck, summarizeReleaseNoteCheck } from '../utils/releaseNoteCheckApi';
import './AutomationRoutinesPage.css';

const DEMO_RUN_MS = 1200;

function formatTime(date) {
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

/** live 루틴의 실행기. 결과는 { ok, label, lines, message } 로 돌려준다. 읽기 전용만 둔다. */
const LIVE_RUNNERS = {
  async releaseNoteCheck() {
    const res = await fetchReleaseNoteCheck();
    if (!res.ok) return { ok: false, message: res.message };
    const { label, lines } = summarizeReleaseNoteCheck(res.data);
    return { ok: true, label, lines };
  },
};

/**
 * 관리자 루틴 자동화 — 카드 한 장 = 루틴 한 개.
 * 실행 흐름: 미리보기 → 확인 → 실행 → 결과·기록.
 * live 루틴(읽기 전용 점검)만 실제로 실행하고, 나머지는 데모라 데이터를 바꾸지 않는다.
 * 상태·기록은 이 화면 메모리에만 있다.
 */
export default function AutomationRoutinesPage() {
  const [runs, setRuns] = useState({}); // id -> { status: 'running' | 'done', at, result }
  const [history, setHistory] = useState([]);
  const [pending, setPending] = useState(null); // 미리보기 중인 루틴
  const [confirmable, setConfirmable] = useState(false);
  const dialogRef = useRef(null);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (pending && !dlg.open) dlg.showModal();
    if (!pending && dlg.open) dlg.close();
  }, [pending]);

  const total = listAutomationRoutines().length;
  const todayCount = history.length;

  async function executeLive(routine) {
    setRuns((prev) => ({ ...prev, [routine.id]: { status: 'running' } }));
    const out = await LIVE_RUNNERS[routine.runner]();
    const at = new Date();
    if (!out.ok) {
      setRuns((prev) => ({ ...prev, [routine.id]: { status: 'error', at, message: out.message } }));
      return;
    }
    setRuns((prev) => ({
      ...prev,
      [routine.id]: { status: 'done', at, result: out.label, lines: out.lines },
    }));
    setHistory((prev) => [
      { id: `${routine.id}-${at.getTime()}`, at, title: routine.title, where: routine.where, result: out.label },
      ...prev,
    ]);
  }

  function execute(routine) {
    if (routine.live) {
      executeLive(routine);
      return;
    }
    setRuns((prev) => ({ ...prev, [routine.id]: { status: 'running' } }));
    const t = setTimeout(() => {
      const at = new Date();
      setRuns((prev) => ({
        ...prev,
        [routine.id]: { status: 'done', at, result: routine.resultLabel },
      }));
      setHistory((prev) => [
        { id: `${routine.id}-${at.getTime()}`, at, title: routine.title, where: routine.where, result: routine.resultLabel },
        ...prev,
      ]);
    }, DEMO_RUN_MS);
    timers.current.push(t);
  }

  function openPreview(routine, canConfirm) {
    setConfirmable(canConfirm);
    setPending(routine);
  }

  function handleRun(routine) {
    if (routine.readOnly) {
      execute(routine);
      return;
    }
    openPreview(routine, true);
  }

  return (
    <div className="automation-page">
      <header className="automation-header">
        <div>
          <h1>루틴 자동화</h1>
          <p>쌓이는 정리 업무를 버튼 한 번으로 실행합니다. 삭제·변경 루틴은 미리보기를 거칩니다.</p>
        </div>
      </header>

      <p className="automation-demo-banner" role="note">
        「릴리즈노트 누락분 점검」만 실제로 실행됩니다(읽기 전용). <b>데모</b> 표시 카드는 실행 흐름만 보여 주며
        실제 데이터는 변경되지 않고, 건수는 예시입니다.
      </p>

      <section className="automation-stats" aria-label="요약">
        <div className="automation-stat">
          <span>등록된 루틴</span>
          <b>{total}</b>
        </div>
        <div className="automation-stat">
          <span>이번 접속 실행</span>
          <b>{todayCount}</b>
        </div>
      </section>

      {AUTOMATION_GROUPS.map((group) => (
        <section key={group.id} className="automation-group">
          <h2 className="automation-group__title">
            {group.title}
            <small>· {group.hint}</small>
          </h2>
          <div className="automation-grid">
            {group.routines.map((routine) => {
              const run = runs[routine.id];
              const running = run?.status === 'running';
              const done = run?.status === 'done';
              const failed = run?.status === 'error';
              return (
                <article key={routine.id} className="automation-card">
                  <div className="automation-card__top">
                    <span className="automation-card__icon" aria-hidden="true">{routine.emoji}</span>
                    <span className="automation-card__badges">
                      {!routine.live && <span className="automation-where automation-where--demo">데모</span>}
                      <span
                        className={`automation-where${routine.where === 'pc' ? ' automation-where--pc' : ''}`}
                      >
                        {AUTOMATION_WHERE[routine.where]}
                      </span>
                    </span>
                  </div>
                  <h3>{routine.title}</h3>
                  <p>{routine.description}</p>
                  <div className="automation-card__meta" role="status" aria-live="polite">
                    <span
                      className={`automation-dot${running ? ' is-running' : done ? ' is-done' : failed ? ' is-failed' : ''}`}
                      aria-hidden="true"
                    />
                    <span>
                      {running
                        ? '실행 중…'
                        : done
                          ? `방금 완료 ${formatTime(run.at)}`
                          : failed
                            ? `실패 ${formatTime(run.at)}`
                            : '아직 실행 안 함'}
                    </span>
                    {done && <b className="automation-card__result">{run.result}</b>}
                  </div>
                  {failed && <p className="automation-card__error">{run.message}</p>}
                  {done && run.lines && (
                    <ul className="automation-card__lines">
                      {run.lines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  )}
                  <div className="automation-card__actions">
                    <button
                      type="button"
                      className="automation-btn automation-btn--primary"
                      disabled={running}
                      onClick={() => handleRun(routine)}
                    >
                      {running ? '실행 중…' : routine.readOnly ? '점검하기' : '실행'}
                    </button>
                    {!routine.readOnly && (
                      <button
                        type="button"
                        className="automation-btn"
                        disabled={running}
                        onClick={() => openPreview(routine, false)}
                      >
                        미리보기
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <section className="automation-history" aria-label="이번 접속 실행 기록">
        <h2>이번 접속 실행 기록</h2>
        {history.length === 0 ? (
          <p className="automation-history__empty">아직 실행한 루틴이 없습니다.</p>
        ) : (
          history.map((h) => (
            <div key={h.id} className="automation-history__row">
              <time>{formatTime(h.at)}</time>
              <span>
                {h.title} · {AUTOMATION_WHERE[h.where]}
              </span>
              <span className="automation-pill">{h.result}</span>
            </div>
          ))
        )}
      </section>

      <p className="automation-foot">
        <b>서버</b> = TMS API에서 처리 · <b>브라우저</b> = 이 화면 안에서 처리 · <b>내 PC</b> = 웹에서 직접 불가,
        내 컴퓨터의 에이전트가 실행합니다.
      </p>

      <dialog ref={dialogRef} className="automation-dialog" onClose={() => setPending(null)}>
        {pending && (
          <>
            <h3>{pending.title}</h3>
            {pending.where === 'pc' && <p className="automation-dialog__note">내 PC의 에이전트가 실행합니다.</p>}
            <ul>
              {(pending.preview || []).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="automation-dialog__note">미리보기 결과입니다. 확인 전에는 아무것도 변경되지 않습니다.</p>
            <div className="automation-dialog__row">
              <button type="button" className="automation-btn" onClick={() => setPending(null)}>
                {confirmable ? '취소' : '닫기'}
              </button>
              {confirmable && (
                <button
                  type="button"
                  className="automation-btn automation-btn--primary"
                  onClick={() => {
                    const r = pending;
                    setPending(null);
                    execute(r);
                  }}
                >
                  확인하고 실행
                </button>
              )}
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
