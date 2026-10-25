import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crown } from 'lucide-react';
import { useJournal } from '../context/JournalProvider';
import { useTeamAccess } from '../hooks/useTeamAccess';
import { useLeaderKpiPendingBadge } from '../hooks/useLeaderKpiPendingBadge';
import { URL_ACCESS_ADMIN } from '../constants/teamAccess';
import { buildAppScopedUrl } from '../utils/appRoute';
import { KPI_MEMBER_PARAM, KPI_TAB_PARAM } from '../utils/kpiDeepLink';
import {
  KIND_TITLE,
  buildAiOfficeAgents,
  buildMemberTaskCounts,
  buildMonthlyMetrics,
  buildMonthlyProgress,
  buildWeeklyDone,
  listOpenTasks,
  pickRescues,
  summarizeOffice,
  timeOfDay,
  toDateKey,
} from '../utils/aiOfficeModel';
import './AiOfficePage.css';

const GOWN = { 작업중: '#ef6fa4', 생각중: '#6fa8ef', 대기: '#b8a9d0', 막힘: '#d6455d' };
const HAIR = ['#f4d06f', '#6b3f2a', '#1b1b1f', '#b5481f', '#e8e4d8'];
const BADGE = { 작업중: '✨', 생각중: '💭', 대기: '💤', 막힘: '🚨' };
const PUFF_COLORS = ['#f7c948', '#f6a6cf', '#c9b3ff', '#fff3a0'];
const RESCUE_MS = 2500;
const BURST_MS = 1400;

/** 14x16 도트 스프라이트. T 왕관·티아라 J 보석 H 머리·모자 S 피부 E 눈 M 입 G 옷 B 허리띠 D 밑단 C 망토 W 수염 */
const SPRITES = {
  princess: {
    eyeRow: 5,
    rows: [
      '......JJ......', '....TTTTTT....', '...HHHHHHHH...', '..HHHHHHHHHH..',
      '..HHSSSSSSHH..', '..HSSESSESSH..', '..HSSESSESSH..', '..HSSSMMSSSH..',
      '..HHSSSSSSHH..', '..HH.SSSS.HH..', '..HGGGGGGGGH..', '...GGGBBGGG...',
      '..GGGGGGGGGG..', '.GGGGGGGGGGGG.', 'GGGGGGGGGGGGGG', 'DDDDDDDDDDDDDD',
    ],
  },
  prince: {
    eyeRow: 5,
    rows: [
      '....T.TT.T....', '....TTJJTT....', '...HHHHHHHH...', '..HHHHHHHHHH..',
      '..HHSSSSSSHH..', '..HSSESSESSH..', '..HSSESSESSH..', '..HSSSMMSSSH..',
      '...HSSSSSSH...', '..CC.SSSS.CC..', '.CCGGGGGGGGCC.', '.CCGGGBBGGGCC.',
      '.CCGGGGGGGGCC.', '.CCGGGGGGGGCC.', '..CGGG..GGGC..', '...KKK..KKK...',
    ],
  },
  wizard: {
    eyeRow: 6,
    rows: [
      '......HH......', '.....HHHH.....', '....HHHHHH....', '...HHHHHHHH...',
      '.HHHHHHHHHHHH.', '...SSSSSSSS...', '...SSESSESS...', '...SSSSSSSS...',
      '...WWSMMSWW...', '..WWWWWWWWWW..', '..GWWWWWWWWG..', '.GGGWWWWWWGGG.',
      '.GGGGWWWWGGGG.', '.GGGGGBBGGGGG.', 'GGGGGGGGGGGGGG', 'DDDDDDDDDDDDDD',
    ],
  },
};

function darken(hex, f = 0.7) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function Sprite({ status, hairIndex, kind = 'princess' }) {
  const gown = GOWN[status] || GOWN.대기;
  const { rows, eyeRow } = SPRITES[kind] || SPRITES.princess;
  const colors = {
    T: '#f7c948', J: kind === 'prince' ? '#e0334b' : '#5ad1e6',
    H: kind === 'wizard' ? '#4b3fa3' : HAIR[hairIndex % HAIR.length],
    S: '#fbd5b5', E: '#2a1b3d', M: '#d6455d', G: gown, B: '#f7c948', D: darken(gown),
    C: '#a02a3c', W: '#f2f2f2', K: '#2a1b3d',
  };
  const rects = [];
  rows.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c === '.') return;
      let fill = colors[c];
      if (c === 'E' && y === eyeRow && status === '대기') fill = colors.S;
      if (c === 'E' && y === eyeRow && status === '작업중') fill = '#2a8fd6';
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={fill} />);
    });
  });
  return (
    <svg viewBox="0 0 14 16" aria-hidden="true">
      {rects}
    </svg>
  );
}

function Puffs() {
  const puffs = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const ang = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 28 + Math.random() * 26;
        return {
          i,
          style: {
            '--dx': `${Math.cos(ang) * dist}px`,
            '--dy': `${Math.sin(ang) * dist}px`,
            '--pc': PUFF_COLORS[i % PUFF_COLORS.length],
            animationDelay: `${Math.random() * 0.15}s`,
          },
        };
      }),
    [],
  );
  return puffs.map(({ i, style }) => (
    <span key={i} className="ai-office__puff" style={style}>
      {i % 3 ? '✦' : '✧'}
    </span>
  ));
}

function WeeklyChart({ rows }) {
  if (!rows.length) return <p className="ai-office__calm">아직 완료한 업무가 없어요.</p>;
  const W = 420;
  const H = 190;
  const m = { t: 12, r: 8, b: 24, l: 30 };
  const max = Math.max(...rows.map((r) => r.tasks), 1);
  const band = (W - m.l - m.r) / rows.length;
  const y = (v) => H - m.b - (v / max) * (H - m.b - m.t);
  const peak = Math.max(...rows.map((r) => r.tasks));
  return (
    <svg className="ai-office__chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="주간 완료 업무">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={m.l} x2={W - m.r} y1={y(max * f)} y2={y(max * f)} className="ai-office__grid" />
          <text x={m.l - 6} y={y(max * f) + 4} textAnchor="end" className="ai-office__tick">
            {Math.round(max * f)}
          </text>
        </g>
      ))}
      {rows.map((r, i) => {
        const [, mo, da] = r.week.split('-');
        const x = m.l + i * band + band * 0.15;
        return (
          <g key={r.week}>
            <rect
              x={x}
              y={y(r.tasks)}
              width={band * 0.7}
              height={H - m.b - y(r.tasks)}
              rx="6"
              fill={r.tasks === peak ? '#ef6fa4' : '#cfc6dc'}
            >
              <title>{`${Number(mo)}/${Number(da)} 주 · ${r.tasks}건`}</title>
            </rect>
            <text x={x + band * 0.35} y={H - 8} textAnchor="middle" className="ai-office__tick">
              {`${Number(mo)}/${Number(da)}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const pct = (v) => `${Math.round(v * 100)}%`;
const pctValue = (v) => (v == null ? '—' : `${Math.round(v * 10) / 10}%`);
const mm = (v) => (Math.round(v * 100) / 100).toLocaleString();

const MONTH_COLORS = { done: '#ef6fa4', open: '#d6455d', planned: '#cfc6dc' };

function MonthlyChart({ rows, selected, onSelect }) {
  const W = 460;
  const H = 200;
  const m = { t: 12, r: 8, b: 24, l: 30 };
  const max = Math.max(...rows.map((r) => r.total), 1);
  const band = (W - m.l - m.r) / rows.length;
  const y = (v) => H - m.b - (v / max) * (H - m.b - m.t);
  return (
    <svg className="ai-office__chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="월별 업무 진행 현황">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={m.l} x2={W - m.r} y1={y(max * f)} y2={y(max * f)} className="ai-office__grid" />
          <text x={m.l - 6} y={y(max * f) + 4} textAnchor="end" className="ai-office__tick">
            {Math.round(max * f)}
          </text>
        </g>
      ))}
      {rows.map((r, i) => {
        const x = m.l + i * band + band * 0.18;
        const w = band * 0.64;
        let top = H - m.b;
        const seg = ['done', 'open', 'planned'].map((key) => {
          const h = (r[key] / max) * (H - m.b - m.t);
          top -= h;
          return h > 0 ? <rect key={key} x={x} y={top} width={w} height={h} fill={MONTH_COLORS[key]} /> : null;
        });
        return (
          <g
            key={r.month}
            className={`ai-office__month${i === selected ? ' is-selected' : ''}`}
            onClick={() => onSelect(i)}
          >
            <rect x={m.l + i * band} y={m.t} width={band} height={H - m.b - m.t} fill="transparent" />
            {seg}
            <text x={x + w / 2} y={H - 8} textAnchor="middle" className="ai-office__tick">
              {`${r.month}월`}
            </text>
            <title>{`${r.month}월 · 완료 ${r.done} · 미완료 ${r.open} · 예정 ${r.planned}`}</title>
          </g>
        );
      })}
    </svg>
  );
}

/** 왕국 전경: 성 실루엣과 깃발. 하늘 색은 시간대를 따라 바뀐다. */
function CastleBanner({ tod, flags }) {
  const towers = [
    { x: 40, w: 46, h: 70 }, { x: 110, w: 60, h: 92 }, { x: 250, w: 100, h: 112 },
    { x: 440, w: 60, h: 92 }, { x: 520, w: 46, h: 70 },
  ];
  return (
    <svg className="ai-office__castle" data-time={tod} viewBox="0 0 600 130" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="ai-office-castle-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="ai-office__sky-top" />
          <stop offset="1" className="ai-office__sky-bottom" />
        </linearGradient>
      </defs>
      <rect width="600" height="130" fill="url(#ai-office-castle-sky)" />
      {towers.map((tw, i) => (
        <g key={tw.x}>
          <rect x={tw.x} y={130 - tw.h} width={tw.w} height={tw.h} className="ai-office__castle-wall" />
          {Array.from({ length: Math.floor(tw.w / 14) }, (_, k) => (
            <rect key={k} x={tw.x + k * 14 + 1} y={130 - tw.h - 8} width="9" height="8" className="ai-office__castle-wall" />
          ))}
          <rect x={tw.x + tw.w / 2 - 5} y={130 - tw.h * 0.55} width="10" height="16" rx="5" className="ai-office__castle-door" />
          {i < flags && (
            <g>
              <rect x={tw.x + tw.w / 2 - 1} y={130 - tw.h - 34} width="2" height="26" fill="#6b4a2f" />
              <path d={`M${tw.x + tw.w / 2 + 1} ${130 - tw.h - 34} l18 6 l-18 6 z`} fill="#d6455d" />
            </g>
          )}
        </g>
      ))}
      <rect x="0" y="122" width="600" height="8" className="ai-office__castle-ground" />
    </svg>
  );
}

const ROOM_TITLE = { 교육팀: '🏰 왕궁 · 교육팀', 관리실: '🔮 마법사의 탑 · 관리실' };
const ROOM_THEME = { 교육팀: 'palace', 관리실: 'tower' };
const TIME_LABEL = { day: '☀️ 낮', dusk: '🌇 저녁', night: '🌙 밤' };

const SEAT_X = 6;
const SEAT_Y = 5.2;
const PAD = 2.4;

/** 윗면·앞면·옆면이 있는 상자. 크기는 --u 단위(숫자)로 받는다. */
function Box({ w, d, h, x = 0, y = 0, className = '', down = false, children }) {
  return (
    <div
      className={`ai-office__box${down ? ' is-down' : ''} ${className}`}
      style={{ '--w': w, '--d': d, '--h': h, left: `calc(${x} * var(--u))`, top: `calc(${y} * var(--u))` }}
    >
      <i className="ai-office__face is-top" />
      <i className="ai-office__face is-front" />
      <i className="ai-office__face is-left" />
      {children}
    </div>
  );
}

/** 방 하나를 아이소메트릭 3D 무대로 그린다. 캐릭터는 책상 뒤에 서 있고, 마우스를 움직이면 시점이 살짝 돌아간다. */
function RoomStage({ list, startIndex, tod, theme, pick, bursting, dispatched, finished, activeHelpers, doneHelpers }) {
  const cols = Math.min(list.length, 3);
  const rows = Math.ceil(list.length / cols);
  const stageRef = useRef(null);

  const onMove = (e) => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const el = stageRef.current;
    const r = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', `${60 - dy * 10}deg`);
    el.style.setProperty('--rz', `${-45 + dx * 16}deg`);
  };
  const onLeave = () => {
    stageRef.current?.style.setProperty('--rx', '60deg');
    stageRef.current?.style.setProperty('--rz', '-45deg');
  };

  return (
    <>
      <div
        ref={stageRef}
        className="ai-office__stage"
        data-time={tod}
        data-theme={theme}
        style={{ '--cols': cols, '--rows': rows }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        <div className="ai-office__plane">
          <Box w="calc(var(--cols) * 6 + 4.8)" d="calc(var(--rows) * 5.2 + 4.8)" h="1.2" down className="is-floor" />
          {theme === 'palace' ? <span className="ai-office__carpet" /> : <span className="ai-office__rune" />}
          <div className="ai-office__wall is-back">
            <span className="ai-office__window" style={{ left: '12%' }} />
            {theme === 'palace' && <span className="ai-office__banner" style={{ left: '44%' }}>♛</span>}
            <span className="ai-office__window" style={{ left: '62%' }} />
          </div>
          <div className="ai-office__wall is-right">
            <span className="ai-office__window" style={{ left: '30%' }} />
          </div>
          {list.map((a, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            return (
              <div
                key={a.id}
                className="ai-office__seat"
                data-s={a.status}
                style={{
                  left: `calc(${PAD + (col + 0.5) * SEAT_X} * var(--u))`,
                  top: `calc(${PAD + (row + 0.5) * SEAT_Y} * var(--u))`,
                }}
              >
                <Box w="5" d="2.4" h="1.7" x={-2.5} y={0.5} className="is-desk" />
                <div className="ai-office__monitor">
                  <span className="ai-office__screen" />
                </div>
                <button
                  type="button"
                  className="ai-office__pawn"
                  aria-label={`${a.name} 상세 보기`}
                  onClick={() => pick(a.id)}
                >
                  <span className="ai-office__nameplate">
                    <b>{a.name}</b>
                    <span className="ai-office__title">{KIND_TITLE[a.kind]}</span>
                    <span className="ai-office__status" style={{ '--s': GOWN[a.status] }}>{a.status}</span>
                    {dispatched.has(a.id) && (
                      <span className="ai-office__tag">{finished.has(a.id) ? '✨ 구조 완료' : '💖 구조 중'}</span>
                    )}
                    {activeHelpers.has(a.id) && (
                      <span className="ai-office__tag">{doneHelpers.has(a.id) ? '🌟 임무 완료' : '🏃 출동 중'}</span>
                    )}
                  </span>
                  <span className="ai-office__bot">
                    <Sprite status={a.status} hairIndex={startIndex + i} kind={a.kind} />
                    <span className="ai-office__badge">{BADGE[a.status]}</span>
                    {a.status === '작업중' && (
                      <>
                        <span className="ai-office__spk ai-office__spk--a">✦</span>
                        <span className="ai-office__spk ai-office__spk--b">✦</span>
                      </>
                    )}
                    {bursting.has(a.id) && <Puffs />}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <ul className="ai-office__roster">
        {list.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => pick(a.id)}>
              <i style={{ background: GOWN[a.status] }} />
              <b>{a.name}</b>
              <span className="ai-office__muted">{KIND_TITLE[a.kind]} · {a.role} · {a.status}</span>
              <span className="ai-office__task">{a.task}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

const CAT_LABEL = { edu: '교육', prep: '교육 준비', ai: 'AI', other: '기타' };

/** 지표·캐릭터를 누르면 나오는 상세. 숫자가 어디서 왔는지와 KPI 관리·일지로 가는 길을 함께 보여준다. */
function DetailPanel({ detail, monthIndex, metrics, counts, openTasks, agent, actions, onClose }) {
  const month = `${monthIndex + 1}월`;
  let title = '';
  let body = null;
  let links = [];

  if (detail.kind === 'tasks') {
    title = '완료·미완료 업무 상세';
    body = (
      <>
        <p className="ai-office__muted">일지 업무 기준, 오늘까지 누적이에요. 미완료는 오늘까지 날짜인데 완료 표시가 없는 업무이고, 예정은 오늘 이후 계획이에요.</p>
        <div className="ai-office__scroll">
          <table className="ai-office__table">
            <thead><tr><th>구성원</th><th>완료</th><th>미완료</th><th>예정</th><th>완료율</th></tr></thead>
            <tbody>
              {counts.map((c) => (
                <tr key={c.code}>
                  <td>{c.name}</td><td>{c.done}</td><td>{c.open}</td><td>{c.planned}</td>
                  <td>{c.done + c.open ? pct(c.rate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h4>미완료 업무 (최근 {openTasks.items.length}건 / 전체 {openTasks.total}건)</h4>
        <OpenTaskTable tasks={openTasks.items} onOpenJournal={actions.openJournalAt} />
      </>
    );
    links = [{ label: '일지에서 보기', onClick: () => actions.openJournal('A') }];
  } else if (detail.kind === 'util') {
    title = `${month} 가동률 상세`;
    body = (
      <>
        <p className="ai-office__muted">가동률 = (업무+생산향상+휴일 M/M) ÷ 가용 M/M. KPI 관리의 「업무 리소스 가동률」과 같은 계산이에요. 그 달 일지가 없는 구성원은 합계에서 빼요.</p>
        <div className="ai-office__scroll">
          <table className="ai-office__table">
            <thead><tr><th>구성원</th><th>가동률</th><th>업무</th><th>향상</th><th>휴일</th><th>합계</th><th>가용</th></tr></thead>
            <tbody>
              {metrics.members.map((m) => (
                <tr key={m.code}>
                  <td>{m.name}</td><td>{pctValue(m.utilization)}</td>
                  {m.hasEntries ? (
                    <><td>{mm(m.work)}</td><td>{mm(m.improve)}</td><td>{mm(m.leave)}</td><td>{mm(m.total)}</td><td>{mm(m.available)}</td></>
                  ) : (
                    <td colSpan={5} className="ai-office__muted">{month} 일지 없음</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
    links = [{ label: 'KPI 관리 · 가동률 보기', onClick: () => actions.openKpi('kpi1') }];
  } else if (detail.kind === 'prod') {
    title = `${month} 생산성 상세`;
    const rows = metrics.members.flatMap((m) => m.effectRows.map((r) => ({ ...r, name: m.name })));
    body = (
      <>
        <p className="ai-office__muted">생산성 = 계획시간 ÷ 실작업시간. 생산성 효과 건으로 표시한 업무만 계산하고, 승인 전 건도 포함해요(100%를 넘는 게 정상이에요).</p>
        {rows.length === 0 ? (
          <p className="ai-office__calm">{month}에는 생산성 효과 건이 없어요.</p>
        ) : (
          <div className="ai-office__scroll">
            <table className="ai-office__table">
              <thead><tr><th>구성원</th><th>업무</th><th>계획(h)</th><th>실작업(h)</th><th>생산성</th><th>상태</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.name}-${r.dayKey}-${r.taskId}`}>
                    <td>{r.name}</td><td>{r.업무명}</td><td>{mm(r.계획시간)}</td><td>{mm(r.실작업시간)}</td>
                    <td>{r['생산성%'] === '' ? '—' : pctValue(r['생산성%'])}</td><td>{r.상태}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
    links = [{ label: 'KPI 관리 · 생산성 보기', onClick: () => actions.openKpi('kpi2') }];
  } else if (agent) {
    const mt = metrics.members.find((m) => m.code === agent.id);
    const count = counts.find((c) => c.code === agent.id);
    title = `${agent.name} · ${KIND_TITLE[agent.kind]} · ${agent.role}`;
    body = (
      <>
        <p className="ai-office__muted"><b>{agent.status}</b> — {agent.task}</p>
        {mt && count ? (
          <div className="ai-office__scroll">
            <table className="ai-office__table">
              <thead><tr><th>완료</th><th>미완료</th><th>예정</th><th>가동률 ({month})</th><th>생산성 ({month})</th></tr></thead>
              <tbody>
                <tr>
                  <td>{count.done}</td><td>{count.open}</td><td>{count.planned}</td>
                  <td>{pctValue(mt.utilization)}</td><td>{pctValue(mt.productivity)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
        {openTasks.items.length > 0 && (
          <>
            <h4>미완료 업무 (최근 {openTasks.items.length}건 / 전체 {openTasks.total}건)</h4>
            <OpenTaskTable tasks={openTasks.items} onOpenJournal={actions.openJournalAt} />
          </>
        )}
      </>
    );
    links = mt
      ? [
          { label: '일지 열기', onClick: () => actions.openJournal(agent.id) },
          { label: 'KPI 관리에서 보기', onClick: () => actions.openKpi('overview', agent.id) },
        ]
      : [{ label: 'KPI 승인 열기', onClick: actions.openApprove }];
  }

  return (
    <section className="ai-office__card ai-office__detail" aria-live="polite">
      <div className="ai-office__detail-head">
        <h3>{title}</h3>
        <button type="button" className="ai-office__close" onClick={onClose} aria-label="상세 닫기">×</button>
      </div>
      {body}
      <div className="ai-office__actions">
        {links.map((l) => (
          <button key={l.label} type="button" className="ai-office__act" onClick={l.onClick}>{l.label} →</button>
        ))}
      </div>
    </section>
  );
}

function OpenTaskTable({ tasks, onOpenJournal }) {
  if (!tasks.length) return <p className="ai-office__calm">미완료 업무가 없어요.</p>;
  return (
    <div className="ai-office__scroll">
      <table className="ai-office__table">
        <thead><tr><th>날짜</th><th>구성원</th><th>업무</th><th>분류</th><th>계획(h)</th></tr></thead>
        <tbody>
          {tasks.map((task, i) => (
            <tr key={`${task.code}-${task.day}-${i}`}>
              <td>
                <button type="button" className="ai-office__link" onClick={() => onOpenJournal(task.code, task.day)}>
                  {task.day.slice(5).replace('-', '/')}
                </button>
              </td>
              <td>{task.name}</td><td>{task.title}</td><td>{CAT_LABEL[task.cat] || task.cat || '—'}</td><td>{mm(task.plan)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AiOfficePage() {
  const { memberJournals } = useJournal();
  const { isAdmin } = useTeamAccess();
  const leaderPending = useLeaderKpiPendingBadge(Boolean(isAdmin));
  const today = toDateKey();

  const agents = useMemo(
    () => buildAiOfficeAgents(memberJournals, { today, adminPending: isAdmin ? leaderPending.count : null }),
    [memberJournals, today, isAdmin, leaderPending.count],
  );
  const summary = useMemo(() => summarizeOffice(agents), [agents]);
  const kingdomRoll = useMemo(() => {
    const n = {};
    agents.forEach((a) => { n[a.kind] = (n[a.kind] || 0) + 1; });
    return `왕국 구성원: ${Object.entries(KIND_TITLE).filter(([k]) => n[k]).map(([k, label]) => `${label} ${n[k]}`).join(' · ')}`;
  }, [agents]);
  const weekly = useMemo(() => buildWeeklyDone(memberJournals, today), [memberJournals, today]);
  const rescues = useMemo(() => pickRescues(agents), [agents]);
  const year = Number(today.slice(0, 4));
  const monthly = useMemo(() => buildMonthlyProgress(memberJournals, year, today), [memberJournals, year, today]);
  // 직접 고르기 전에는 오늘까지 일지가 있는 가장 최근 달을 보여준다
  const [pickedMonth, setPickedMonth] = useState(null);
  const monthIndex = useMemo(() => {
    if (pickedMonth != null) return pickedMonth;
    const current = Number(today.slice(5, 7)) - 1;
    for (let i = current; i >= 0; i -= 1) if (monthly[i].total > 0) return i;
    return current;
  }, [pickedMonth, monthly, today]);
  const setMonthIndex = setPickedMonth;
  const metrics = useMemo(() => buildMonthlyMetrics(memberJournals, year, monthIndex), [memberJournals, year, monthIndex]);
  const metricByCode = useMemo(() => new Map(metrics.members.map((m) => [m.code, m])), [metrics]);

  const [detail, setDetail] = useState(null);
  const detailRef = useRef(null);
  const counts = useMemo(() => buildMemberTaskCounts(memberJournals, today), [memberJournals, today]);
  const detailAgent = detail?.kind === 'member' ? agents.find((a) => a.id === detail.code) : null;
  const openTasks = useMemo(() => {
    if (!detail) return { items: [], total: 0 };
    if (detail.kind === 'tasks') return listOpenTasks(memberJournals, { today, limit: 30 });
    if (detail.kind === 'member' && detail.code !== 'admin') {
      return listOpenTasks(memberJournals, { today, memberCode: detail.code, limit: 10 });
    }
    return { items: [], total: 0 };
  }, [detail, memberJournals, today]);
  const toggleDetail = useCallback((next) => {
    setDetail((cur) => (cur && cur.kind === next.kind && cur.code === next.code ? null : next));
  }, []);
  useEffect(() => {
    if (detail) detailRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [detail]);

  // 같은 앱 안에서 다른 메뉴로 이동 (전체 새로고침 없이)
  const go = useCallback((module, { month, member, access, extra } = {}) => {
    const url = buildAppScopedUrl(module, { year, month, member, access });
    Object.entries(extra || {}).forEach(([key, value]) => url.searchParams.set(key, value));
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [year]);
  const actions = useMemo(
    () => ({
      openJournal: (code) => go('journal', { month: monthIndex + 1, member: code, access: URL_ACCESS_ADMIN }),
      openJournalAt: (code, day) =>
        go('journal', { month: Number(day.slice(5, 7)), member: code, access: URL_ACCESS_ADMIN }),
      openKpi: (tab, code) =>
        go('kpi', {
          month: monthIndex + 1,
          extra: { [KPI_TAB_PARAM]: tab, ...(code ? { [KPI_MEMBER_PARAM]: code } : {}) },
        }),
      openApprove: () => go('kpi-approve', { month: monthIndex + 1 }),
    }),
    [go, monthIndex],
  );
  const rooms = useMemo(() => {
    const map = new Map();
    agents.forEach((a) => map.set(a.room, [...(map.get(a.room) || []), a]));
    return [...map.entries()];
  }, [agents]);

  // 구조 연출은 화면 안에서만 — 일지 데이터나 상태는 바꾸지 않는다
  const [dispatched, setDispatched] = useState(() => new Set());
  const [finished, setFinished] = useState(() => new Set());
  const [bursting, setBursting] = useState(() => new Set());
  const timers = useRef([]);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const tod = timeOfDay(now);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const dispatchRescue = useCallback((blockedId, helperId) => {
    setDispatched((prev) => new Set(prev).add(blockedId));
    timers.current.push(
      setTimeout(() => {
        setFinished((prev) => new Set(prev).add(blockedId));
        setBursting((prev) => new Set(prev).add(blockedId).add(helperId));
        timers.current.push(
          setTimeout(() => {
            setBursting((prev) => {
              const next = new Set(prev);
              next.delete(blockedId);
              next.delete(helperId);
              return next;
            });
          }, BURST_MS),
        );
      }, RESCUE_MS),
    );
  }, []);

  const helperOf = new Map(rescues.filter((r) => r.helper).map((r) => [r.blocked.id, r.helper.id]));
  const activeHelpers = new Set(
    [...dispatched].map((id) => helperOf.get(id)).filter(Boolean),
  );
  const doneHelpers = new Set([...finished].map((id) => helperOf.get(id)).filter(Boolean));

  let seat = 0;
  return (
    <div className="ai-office">
      <header className="ai-office__header">
        <CastleBanner tod={tod} flags={summary.working + 1} />
        <h2>
          <Crown size={26} className="ai-office__crown" aria-hidden="true" />
          AI 사무실 · 왕국
        </h2>
        <p>
          교육팀 구성원 <b>{summary.headcount}</b>명 중 <b>{summary.working}</b>명이 업무를 진행 중이고,{' '}
          <b>{summary.blocked}</b>명이 막혀 있어요. 일지를 저장하면 캐릭터가 바로 바뀌어요.
        </p>
        <p className="ai-office__muted">{kingdomRoll}</p>
      </header>

      <section className={`ai-office__card ai-office__rescue${rescues.length ? '' : ' is-calm'}`} aria-live="polite">
        <h3>🚨 구조 알림</h3>
        {rescues.length === 0 ? (
          <p className="ai-office__calm">지금은 막힌 구성원이 없어요. 평화로운 왕국이에요 🌸</p>
        ) : (
          <div className="ai-office__rescue-list">
            {rescues.map(({ blocked, helper }) => (
              <div key={blocked.id} className="ai-office__rescue-card">
                <div>
                  <b>{blocked.name}</b> ({blocked.room})가 막혔어요
                </div>
                <div className="ai-office__muted">{blocked.task}</div>
                {helper && (
                  <div className="ai-office__muted">
                    도우미 후보 · <b>{helper.name}</b> {helper.role}
                  </div>
                )}
                <button
                  type="button"
                  className="ai-office__rescue-btn"
                  disabled={!helper || dispatched.has(blocked.id)}
                  onClick={() => dispatchRescue(blocked.id, helper.id)}
                >
                  {finished.has(blocked.id) ? '구조 완료 ✨' : dispatched.has(blocked.id) ? '출동 중…' : '구조대 출동'}
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="ai-office__muted ai-office__fine">
          출동은 화면 연출이에요. 실제 알림은 가지 않고 새로고침하면 사라져요. 막힘 기준은 오늘까지 잡힌 업무의 완료율 70% 미만이에요.
        </p>
      </section>

      <div className="ai-office__monthbar">
        <span className="ai-office__muted">지표 기준 월</span>
        <button type="button" disabled={monthIndex === 0} onClick={() => setMonthIndex(monthIndex - 1)} aria-label="이전 달">‹</button>
        <b>{year}년 {monthIndex + 1}월</b>
        <button type="button" disabled={monthIndex === 11} onClick={() => setMonthIndex(monthIndex + 1)} aria-label="다음 달">›</button>
      </div>

      <section className="ai-office__kpis">
        <button type="button" className="ai-office__card ai-office__kpi" aria-pressed={detail?.kind === 'tasks'} onClick={() => toggleDetail({ kind: 'tasks' })}><span>완료한 업무</span><strong>{summary.done.toLocaleString()}</strong><em>일지 기준, 오늘까지 누적 · 눌러서 상세</em></button>
        <button type="button" className="ai-office__card ai-office__kpi" aria-pressed={detail?.kind === 'tasks'} onClick={() => toggleDetail({ kind: 'tasks' })}><span>업무 완료율</span><strong>{pct(summary.rate)}</strong><em>완료 ÷ 전체 업무 · 눌러서 상세</em></button>
        <button type="button" className="ai-office__card ai-office__kpi" aria-pressed={detail?.kind === 'util'} onClick={() => toggleDetail({ kind: 'util' })}><span>팀 가동률 ({monthIndex + 1}월)</span><strong>{pctValue(metrics.team.utilization)}</strong><em>업무·향상·휴일 M/M ÷ 가용 M/M · 눌러서 상세</em></button>
        <button type="button" className="ai-office__card ai-office__kpi" aria-pressed={detail?.kind === 'prod'} onClick={() => toggleDetail({ kind: 'prod' })}><span>팀 생산성 ({monthIndex + 1}월)</span><strong>{pctValue(metrics.team.productivity)}</strong><em>{metrics.team.effectCount ? `효과 ${metrics.team.effectCount}건 · 계획 ÷ 실작업 · 눌러서 상세` : '이 달 효과 건 없음 · 눌러서 상세'}</em></button>
      </section>

      {detail && (detail.kind !== 'member' || detailAgent) && (
        <div ref={detailRef}>
          <DetailPanel
            detail={detail}
            monthIndex={monthIndex}
            metrics={metrics}
            counts={counts}
            openTasks={openTasks}
            agent={detailAgent}
            actions={actions}
            onClose={() => setDetail(null)}
          />
        </div>
      )}

      <section className="ai-office__card">
        <h3>왕국 사무실 현황</h3>
        <p className="ai-office__muted">오늘 일지를 쓰면 드레스가 반짝이고 별가루가 흩날려요. 캐릭터를 누르면 상세가 열려요.</p>
        <div className="ai-office__legend">
          {Object.entries(GOWN).map(([label, color]) => (
            <span key={label}><i style={{ background: color }} />{label}</span>
          ))}
          <span className="ai-office__clock">{TIME_LABEL[tod]} · {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')} · 마우스를 올리면 시점이 돌아가요</span>
        </div>
        <div className="ai-office__floor">
          {rooms.map(([room, list]) => {
            const startIndex = seat;
            seat += list.length;
            const theme = ROOM_THEME[room] || 'palace';
            return (
              <div key={room} className="ai-office__room" data-theme={theme}>
                <span className="ai-office__room-name">{ROOM_TITLE[room] || room}</span>
                <RoomStage
                  theme={theme}
                  list={list}
                  startIndex={startIndex}
                  tod={tod}
                  pick={(id) => toggleDetail({ kind: 'member', code: id })}
                  bursting={bursting}
                  dispatched={dispatched}
                  finished={finished}
                  activeHelpers={activeHelpers}
                  doneHelpers={doneHelpers}
                />
              </div>
            );
          })}
        </div>
      </section>

      <div className="ai-office__grid2">
        <section className="ai-office__card">
          <h3>월별 업무 진행 ({year}년)</h3>
          <p className="ai-office__muted">일지 업무 기준. 막대를 누르면 지표 기준 월이 바뀌어요.</p>
          <div className="ai-office__legend">
            <span><i style={{ background: MONTH_COLORS.done }} />완료</span>
            <span><i style={{ background: MONTH_COLORS.open }} />미완료(오늘까지)</span>
            <span><i style={{ background: MONTH_COLORS.planned }} />예정</span>
          </div>
          <MonthlyChart rows={monthly} selected={monthIndex} onSelect={setMonthIndex} />
          <table className="ai-office__table">
            <thead>
              <tr><th>월</th><th>완료</th><th>미완료</th><th>예정</th><th>완료율</th></tr>
            </thead>
            <tbody>
              {monthly.filter((r) => r.total > 0).map((r) => (
                <tr key={r.month} className={r.month === monthIndex + 1 ? 'is-selected' : undefined}>
                  <td>{r.month}월</td><td>{r.done}</td><td>{r.open}</td><td>{r.planned}</td>
                  <td>{r.done + r.open ? pct(r.rate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="ai-office__card">
          <h3>주간 완료 업무</h3>
          <p className="ai-office__muted">월요일 기준 주별, 팀 전체 (최근 8주)</p>
          <WeeklyChart rows={weekly} />
        </section>
      </div>

      <section className="ai-office__card">
        <h3>구성원 업무 현황</h3>
        <p className="ai-office__muted">완료 업무 순. 가동률·생산성은 {monthIndex + 1}월 기준이고, 그 달 일지가 없으면 —로 표시해요.</p>
        <div className="ai-office__scroll">
          <table className="ai-office__table">
            <thead>
              <tr>
                <th>이름</th><th>역할</th><th>상태</th><th>완료 업무</th><th>완료율</th>
                <th>가동률</th><th>생산성</th><th>업무 M/M</th><th>가용 M/M</th>
              </tr>
            </thead>
            <tbody>
              {[...agents].sort((x, y) => y.done - x.done).map((a) => {
                const mt = metricByCode.get(a.id);
                return (
                  <tr key={a.id}>
                    <td><button type="button" className="ai-office__link" onClick={() => toggleDetail({ kind: 'member', code: a.id })}>{a.name}</button></td><td>{a.role}</td><td>{a.status}</td><td>{a.done}</td><td>{a.total ? pct(a.rate) : '—'}</td>
                    <td>{mt ? pctValue(mt.utilization) : '—'}</td>
                    <td>{mt ? pctValue(mt.productivity) : '—'}</td>
                    <td>{mt?.hasEntries ? mm(mt.work + mt.improve) : '—'}</td>
                    <td>{mt?.hasEntries ? mm(mt.available) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
