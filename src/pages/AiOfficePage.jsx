import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crown } from 'lucide-react';
import { useJournal } from '../context/JournalProvider';
import { useTeamAccess } from '../hooks/useTeamAccess';
import { useLeaderKpiPendingBadge } from '../hooks/useLeaderKpiPendingBadge';
import {
  buildAiOfficeAgents,
  buildWeeklyDone,
  pickRescues,
  summarizeOffice,
  toDateKey,
} from '../utils/aiOfficeModel';
import './AiOfficePage.css';

const GOWN = { 작업중: '#ef6fa4', 생각중: '#6fa8ef', 대기: '#b8a9d0', 막힘: '#d6455d' };
const HAIR = ['#f4d06f', '#6b3f2a', '#1b1b1f', '#b5481f', '#e8e4d8'];
const BADGE = { 작업중: '✨', 생각중: '💭', 대기: '💤', 막힘: '🚨' };
const PUFF_COLORS = ['#f7c948', '#f6a6cf', '#c9b3ff', '#fff3a0'];
const RESCUE_MS = 2500;
const BURST_MS = 1400;

/** 14x16 도트 공주: T 티아라 J 보석 H 머리 S 피부 E 눈 M 입 G 드레스 B 허리띠 D 밑단 */
const SPRITE = [
  '......JJ......', '....TTTTTT....', '...HHHHHHHH...', '..HHHHHHHHHH..',
  '..HHSSSSSSHH..', '..HSSESSESSH..', '..HSSESSESSH..', '..HSSSMMSSSH..',
  '..HHSSSSSSHH..', '..HH.SSSS.HH..', '..HGGGGGGGGH..', '...GGGBBGGG...',
  '..GGGGGGGGGG..', '.GGGGGGGGGGGG.', 'GGGGGGGGGGGGGG', 'DDDDDDDDDDDDDD',
];

function darken(hex, f = 0.7) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function Sprite({ status, hairIndex }) {
  const gown = GOWN[status] || GOWN.대기;
  const colors = {
    T: '#f7c948', J: '#5ad1e6', H: HAIR[hairIndex % HAIR.length], S: '#fbd5b5',
    E: '#2a1b3d', M: '#d6455d', G: gown, B: '#f7c948', D: darken(gown),
  };
  const rects = [];
  SPRITE.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c === '.') return;
      let fill = colors[c];
      if (c === 'E' && y === 5 && status === '대기') fill = colors.S;
      if (c === 'E' && y === 5 && status === '작업중') fill = '#2a8fd6';
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
  const weekly = useMemo(() => buildWeeklyDone(memberJournals, today), [memberJournals, today]);
  const rescues = useMemo(() => pickRescues(agents), [agents]);
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
        <h2>
          <Crown size={26} className="ai-office__crown" aria-hidden="true" />
          AI 사무실
        </h2>
        <p>
          교육팀 구성원 <b>{summary.headcount}</b>명 중 <b>{summary.working}</b>명이 업무를 진행 중이고,{' '}
          <b>{summary.blocked}</b>명이 막혀 있어요. 일지를 저장하면 캐릭터가 바로 바뀌어요.
        </p>
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

      <section className="ai-office__kpis">
        <div className="ai-office__card ai-office__kpi"><span>완료한 업무</span><strong>{summary.done.toLocaleString()}</strong><em>오늘까지, 팀 전체</em></div>
        <div className="ai-office__card ai-office__kpi"><span>업무 완료율</span><strong>{pct(summary.rate)}</strong><em>완료 ÷ 전체 업무</em></div>
        <div className="ai-office__card ai-office__kpi"><span>실적 시간</span><strong>{summary.hours.toLocaleString()}</strong><em>일지에 기록한 시간</em></div>
        <div className="ai-office__card ai-office__kpi"><span>업무 진행 비율</span><strong>{pct(summary.activeShare)}</strong><em>대기가 아닌 구성원 비율</em></div>
      </section>

      <section className="ai-office__card">
        <h3>왕국 사무실 현황</h3>
        <p className="ai-office__muted">오늘 일지를 쓰면 드레스가 반짝이고 별가루가 흩날려요.</p>
        <div className="ai-office__legend">
          {Object.entries(GOWN).map(([label, color]) => (
            <span key={label}><i style={{ background: color }} />{label}</span>
          ))}
        </div>
        <div className="ai-office__floor">
          {rooms.map(([room, list]) => (
            <div key={room} className="ai-office__room">
              <span className="ai-office__room-name">{room}</span>
              <div className="ai-office__desks">
                {list.map((a) => {
                  const idx = seat++;
                  return (
                    <div key={a.id} className="ai-office__desk" data-s={a.status}>
                      <div className="ai-office__bot">
                        <Sprite status={a.status} hairIndex={idx} />
                        <span className="ai-office__badge">{BADGE[a.status]}</span>
                        {a.status === '작업중' && (
                          <>
                            <span className="ai-office__spk ai-office__spk--a">✦</span>
                            <span className="ai-office__spk ai-office__spk--b">✦</span>
                          </>
                        )}
                        {bursting.has(a.id) && <Puffs />}
                      </div>
                      {dispatched.has(a.id) && (
                        <span className="ai-office__tag">{finished.has(a.id) ? '✨ 구조 완료' : '💖 구조 중'}</span>
                      )}
                      {activeHelpers.has(a.id) && (
                        <span className="ai-office__tag">{doneHelpers.has(a.id) ? '🌟 임무 완료' : '🏃 출동 중'}</span>
                      )}
                      <b>{a.name}</b>
                      <span className="ai-office__muted">{a.role}</span>
                      <span className="ai-office__status" style={{ '--s': GOWN[a.status] }}>{a.status}</span>
                      <span className="ai-office__task">{a.task}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="ai-office__grid2">
        <section className="ai-office__card">
          <h3>주간 완료 업무</h3>
          <p className="ai-office__muted">월요일 기준 주별, 팀 전체 (최근 8주)</p>
          <WeeklyChart rows={weekly} />
        </section>
        <section className="ai-office__card">
          <h3>구성원 업무 현황</h3>
          <p className="ai-office__muted">완료 업무 순</p>
          <table className="ai-office__table">
            <thead>
              <tr><th>이름</th><th>역할</th><th>상태</th><th>완료 업무</th><th>완료율</th></tr>
            </thead>
            <tbody>
              {[...agents].sort((x, y) => y.done - x.done).map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td><td>{a.role}</td><td>{a.status}</td><td>{a.done}</td><td>{a.total ? pct(a.rate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
