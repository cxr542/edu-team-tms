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

const STATUS_COLOR = { 작업중: '#f59e42', 생각중: '#5aa9e6', 대기: '#a9bfa0', 막힘: '#d6455d' };
const FUR = ['#e8b86d', '#f3e6cf', '#b9b4ad', '#c98f5a'];
const BADGE = { 작업중: '🌰', 생각중: '💭', 대기: '💤', 막힘: '🚨' };
const PUFF_COLORS = ['#6fbf73', '#ffd166', '#f59e42', '#fff3a0'];
const PUFF_GLYPHS = ['🍃', '✦', '🌰'];
const RESCUE_MS = 2500;
const BURST_MS = 1400;

/** 14x16 도트 햄스터. F 털 L 밝은 배·볼 P 분홍 귀·볼 N 코 E 눈 G 조끼 T 이장님 새싹 K 발 */
const HAMSTER = [
  '..FF......FF..', '.FPPF....FPPF.', '.FFFFFFFFFFFF.', 'FFFFFFFFFFFFFF',
  'FFFEFFFFFFEFFF', 'FFFEFFFFFFEFFF', 'FFPPLLNNLLPPFF', 'FFLLLLLLLLLLFF',
  '.FFLLLLLLLLFF.', '..FGGGGGGGGF..', '.FFGGGGGGGGFF.', '.FFGGGLLGGGFF.',
  '..FGGLLLLGGF..', '..FGGGGGGGGF..', '..FFF....FFF..', '..KKK....KKK..',
];
const MAYOR = ['..FF..TT..FF..', '.FPPF.TT.FPPF.', ...HAMSTER.slice(2)];
const SPRITES = { villager: HAMSTER, mayor: MAYOR };
const EYE_ROW = 4;

function darken(hex, f = 0.7) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function Sprite({ status, furIndex, kind = 'villager' }) {
  const vest = STATUS_COLOR[status] || STATUS_COLOR.대기;
  const rows = SPRITES[kind] || HAMSTER;
  const colors = {
    F: FUR[furIndex % FUR.length], L: '#fff4df', P: '#f4a3b5', N: '#e0788f', E: '#2a1b3d',
    G: vest, T: '#5bb85d', K: '#5a3b2a',
  };
  const rects = [];
  rows.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c === '.') return;
      let fill = colors[c];
      if (c === 'E' && y === EYE_ROW && status === '대기') fill = colors.F;
      if (c === 'E' && status === '작업중') fill = '#1f6fb5';
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
      {PUFF_GLYPHS[i % PUFF_GLYPHS.length]}
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
              fill={r.tasks === peak ? '#6fbf73' : '#d9d3c0'}
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

const MONTH_COLORS = { done: '#6fbf73', open: '#d6455d', planned: '#d9d3c0' };

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

/** 마을 전경: 언덕·나무·집. 하늘 색과 창문 불빛은 시간대를 따라 바뀐다. */
function VillageBanner({ tod }) {
  const trees = [{ x: 30, y: 96, r: 16 }, { x: 70, y: 100, r: 12 }, { x: 330, y: 98, r: 15 }, { x: 560, y: 96, r: 17 }];
  const houses = [
    { x: 130, w: 54, roof: '#e07a5f' },
    { x: 230, w: 66, roof: '#6fbf73' },
    { x: 400, w: 58, roof: '#5aa9e6' },
    { x: 480, w: 44, roof: '#f2b134' },
  ];
  return (
    <svg className="ai-office__village" data-time={tod} viewBox="0 0 600 130" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="ai-office-village-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="ai-office__sky-top" />
          <stop offset="1" className="ai-office__sky-bottom" />
        </linearGradient>
      </defs>
      <rect width="600" height="130" fill="url(#ai-office-village-sky)" />
      <ellipse cx="110" cy="26" rx="26" ry="9" className="ai-office__v-cloud" />
      <ellipse cx="128" cy="22" rx="16" ry="8" className="ai-office__v-cloud" />
      <ellipse cx="430" cy="34" rx="30" ry="9" className="ai-office__v-cloud" />
      <ellipse cx="300" cy="150" rx="420" ry="62" className="ai-office__v-hill is-back" />
      <ellipse cx="120" cy="156" rx="300" ry="56" className="ai-office__v-hill" />
      {houses.map((h) => (
        <g key={h.x}>
          <rect x={h.x} y={86} width={h.w} height={34} className="ai-office__v-wall" />
          <path d={`M${h.x - 6} 88 L${h.x + h.w / 2} 62 L${h.x + h.w + 6} 88 Z`} fill={h.roof} />
          <rect x={h.x + h.w / 2 - 6} y={100} width="12" height="20" rx="6" className="ai-office__v-door" />
          <rect x={h.x + 7} y={94} width="9" height="9" rx="2" className="ai-office__v-window" />
        </g>
      ))}
      {trees.map((tr) => (
        <g key={tr.x}>
          <rect x={tr.x - 2.5} y={tr.y} width="5" height={24} className="ai-office__v-trunk" />
          <circle cx={tr.x} cy={tr.y - 2} r={tr.r} className="ai-office__v-leaf" />
        </g>
      ))}
      <rect x="0" y="120" width="600" height="10" className="ai-office__v-ground" />
    </svg>
  );
}

const TIME_LABEL = { day: '☀️ 낮', dusk: '🌇 저녁', night: '🌙 밤' };

const SEAT_X = 6.4;
const SEAT_Y = 6;
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

const SNACKS = ['🍪', '🍫', '🍩', '🍬', '🥐'];

/** 사무실 바닥 크기(--u 단위)와 구역별 자리 배치. 방 이름이 같은 구성원은 같은 구역에 줄지어 앉는다. */
const OFFICE_W = 44;
const OFFICE_D = 22;
const ZONES = {
  교육팀: { x: 4.4, y: 4.6, perRow: 3 },
  관리실: { x: 33.6, y: 4.6, perRow: 1 },
};

function seatPositions(agents) {
  const used = {};
  const seats = agents.map((a) => {
    const key = ZONES[a.room] ? a.room : '교육팀';
    const zone = ZONES[key];
    const n = (used[key] = (used[key] ?? -1) + 1);
    const col = n % zone.perRow;
    const row = Math.floor(n / zone.perRow);
    return { a, key, col, row, x: zone.x + col * SEAT_X, y: zone.y + row * SEAT_Y };
  });
  const taken = new Set(seats.map((s) => `${s.key}-${s.row}-${s.col}`));
  return seats.map((s) => ({ ...s, last: !taken.has(`${s.key}-${s.row}-${s.col + 1}`) }));
}

const u = (n) => `calc(${n} * var(--u))`;

/** 바닥에 깔리는 평평한 구역(러그·타일). 좌표와 크기는 --u 단위. */
function Zone({ x, y, w, d, className }) {
  return <span className={`ai-office__zone ${className}`} style={{ left: u(x), top: u(y), width: u(w), height: u(d) }} />;
}

/**
 * 사무실 하나를 아이소메트릭 3D 무대로 그린다. 교육팀·이장님 자리, 휴게 공간, 간식창고가 한 바닥에 이어지고,
 * 마우스를 움직이면 시점이 살짝 돌아간다. 간식창고의 아이스크림 냉장고는 눌러서 열고 닫는다(꾸밈용).
 */
function Office({ agents, tod, pick, bursting, dispatched, finished, activeHelpers, doneHelpers }) {
  const stageRef = useRef(null);
  const [fridgeOpen, setFridgeOpen] = useState(false);
  const toggleFridge = () => setFridgeOpen((v) => !v);
  const seats = useMemo(() => seatPositions(agents), [agents]);

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

  const groups = [...new Set(agents.map((a) => (ZONES[a.room] ? a.room : '교육팀')))];

  return (
    <>
      <div
        ref={stageRef}
        className="ai-office__stage"
        data-time={tod}
        style={{ '--pw': OFFICE_W, '--pd': OFFICE_D }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        <div className="ai-office__plane">
          <Box w={OFFICE_W} d={OFFICE_D} h="1.2" down className="is-floor" />

          {/* 바닥 구역 */}
          <Zone x={2} y={3} w={23} d={9.6} className="is-rug is-warm" />
          <Zone x={30.6} y={2.8} w={11} d={9} className="is-rug is-green" />
          <Zone x={3} y={13.4} w={17} d={7.4} className="is-rug is-blue" />
          <Zone x={28.6} y={12} w={15.4} d={10} className="is-tiles" />

          {/* 벽 */}
          <div className="ai-office__wall is-back">
            {[3, 15, 27, 63, 75, 87].map((l) => (
              <span key={l} className="ai-office__window" style={{ left: `${l}%`, width: '9%' }} />
            ))}
            <span className="ai-office__wallitem" style={{ left: '46%' }}>🕰️</span>
            <span className="ai-office__wallitem" style={{ left: '52%' }}>🖼️</span>
            <span className="ai-office__wallsign" style={{ left: '8%' }}>🏡 교육팀</span>
            <span className="ai-office__wallsign" style={{ left: '73%' }}>🌳 이장님 자리</span>
          </div>
          <div className="ai-office__wall is-right">
            <span className="ai-office__window" style={{ left: '6%', width: '16%' }} />
            <span className="ai-office__window" style={{ left: '28%', width: '16%' }} />
            <span className="ai-office__wallsign" style={{ left: '60%' }}>🍪 간식창고</span>
          </div>
          {/* 교육팀과 이장님 자리 사이의 유리 칸막이 */}
          <span className="ai-office__partition is-side is-glass" style={{ left: u(28.4), top: u(0), height: u(10.6) }} />

          {/* 구성원 자리 */}
          {seats.map(({ a, x, y, col, last }, i) => (
            <div
              key={a.id}
              className="ai-office__seat"
              data-s={a.status}
              style={{ left: u(x), top: u(y) }}
            >
              <span className="ai-office__pool" />
              <span className="ai-office__partition is-back" />
              <span className="ai-office__partition is-side is-left" />
              {last && <span className="ai-office__partition is-side is-right" />}
              <Box w="5" d="2.4" h="1.7" x={-2.5} y={0.5} className="is-desk" />
              {[-1, 0, 1].map((k) => (
                <div key={k} className="ai-office__monitor" style={{ '--mx': k }}>
                  <span className="ai-office__screen" />
                </div>
              ))}
              <span className="ai-office__lamp" />
              <button
                type="button"
                className="ai-office__pawn"
                aria-label={`${a.name} 상세 보기`}
                onClick={() => pick(a.id)}
              >
                <span className="ai-office__nameplate">
                  <b>{a.name}</b>
                  <span className="ai-office__title">{KIND_TITLE[a.kind]}</span>
                  <span className="ai-office__status" style={{ '--s': STATUS_COLOR[a.status] }}>{a.status}</span>
                  {dispatched.has(a.id) && (
                    <span className="ai-office__tag">{finished.has(a.id) ? '✨ 구조 완료' : '💖 구조 중'}</span>
                  )}
                  {activeHelpers.has(a.id) && (
                    <span className="ai-office__tag">{doneHelpers.has(a.id) ? '🌟 임무 완료' : '🏃 출동 중'}</span>
                  )}
                </span>
                <span className="ai-office__bot">
                  <Sprite status={a.status} furIndex={i} kind={a.kind} />
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
          ))}

          {/* 휴게 공간: 소파와 커피 테이블 */}
          <Box w="7.4" d="0.9" h="2.6" x={5.4} y={18.4} className="is-sofa" />
          <Box w="7.4" d="2.6" h="1.4" x={5.4} y={19.2} className="is-sofa" />
          <Box w="3.6" d="2" h="1" x={7.4} y={15} className="is-table" />
          <span className="ai-office__prop" style={{ left: u(8.4), top: u(16), '--z': 1, '--fs': 1.5 }}>☕</span>
          <span className="ai-office__prop" style={{ left: u(10.2), top: u(16), '--z': 1, '--fs': 1.5 }}>📚</span>
          <span className="ai-office__prop" style={{ left: u(9), top: u(21), '--z': 1.4, '--fs': 1.7 }}>🧸</span>
          <span className="ai-office__prop" style={{ left: u(3.2), top: u(15), '--fs': 2.6 }}>🪴</span>
          <span className="ai-office__prop" style={{ left: u(19.2), top: u(15), '--fs': 2.6 }}>🪴</span>
          <span className="ai-office__prop" style={{ left: u(2), top: u(2.6), '--fs': 2.6 }}>🪴</span>
          <span className="ai-office__prop" style={{ left: u(OFFICE_W - 2.2), top: u(2.6), '--fs': 2.6 }}>📮</span>

          {/* 간식창고: 과자 선반, 테이블, 아이스크림 냉장고 */}
          <span className="ai-office__pool is-room" style={{ left: u(27), top: u(9.6) }} />
          <span
            className={`ai-office__pool is-chill${fridgeOpen ? ' is-open' : ''}`}
            style={{ left: u(30.4), top: u(11) }}
          />
          <Box w="1.8" d="9.2" h="3.2" x={41.8} y={12.2} className="is-shelf" />
          {SNACKS.map((s, i) => (
            <span
              key={s}
              className="ai-office__prop"
              style={{ left: u(42.7), top: u(13.4 + i * 1.8), '--z': 3.2, '--fs': 1.9 }}
            >
              {s}
            </span>
          ))}
          <Box w="3.4" d="2.4" h="1.6" x={31.2} y={18.4} className="is-table" />
          <span className="ai-office__prop" style={{ left: u(32.9), top: u(19.6), '--z': 1.6, '--fs': 1.7 }}>🫙</span>
          <span className="ai-office__prop" style={{ left: u(30), top: u(21), '--fs': 2.2 }}>🧺</span>
          <span className="ai-office__prop" style={{ left: u(38.4), top: u(21.4), '--fs': 2 }}>🍎</span>
          <Box w="5" d="3" h="2.4" x={34.6} y={13} className={`is-freezer${fridgeOpen ? ' is-open' : ''}`} />
          <button
            type="button"
            className={`ai-office__prop ai-office__fz${fridgeOpen ? ' is-open' : ''}`}
            style={{ left: u(37.1), top: u(15.4), '--z': 2.4 }}
            aria-pressed={fridgeOpen}
            aria-label="아이스크림 냉장고 열고 닫기"
            onClick={toggleFridge}
          >
            <span className="ai-office__fz-items">{fridgeOpen ? '🍦🍨🍧' : '🍦'}</span>
            <small>아이스크림 냉장고</small>
            {fridgeOpen && <span className="ai-office__mist">❄️</span>}
          </button>
        </div>
      </div>

      <div className="ai-office__rosters">
        {groups.map((room) => (
          <ul key={room} className="ai-office__roster">
            {agents.filter((a) => (ZONES[a.room] ? a.room : '교육팀') === room).map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => pick(a.id)}>
                  <i style={{ background: STATUS_COLOR[a.status] }} />
                  <b>{a.name}</b>
                  <span className="ai-office__muted">{KIND_TITLE[a.kind]} · {a.role} · {a.status}</span>
                  <span className="ai-office__task">{a.task}</span>
                </button>
              </li>
            ))}
          </ul>
        ))}
        <ul className="ai-office__roster">
          <li>
            <button type="button" aria-pressed={fridgeOpen} onClick={toggleFridge}>
              <i style={{ background: '#5aa9e6' }} />
              <b>🍦 아이스크림 냉장고</b>
              <span className="ai-office__muted">{fridgeOpen ? '열려 있어요' : '닫혀 있어요'}</span>
              <span className="ai-office__task">간식창고 · 눌러서 열고 닫아 보세요. 햄스터들이 일하다 쉬어 가는 곳이에요.</span>
            </button>
          </li>
        </ul>
      </div>
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
    return `마을 주민: ${Object.entries(KIND_TITLE).filter(([k]) => n[k]).map(([k, label]) => `${label} ${n[k]}`).join(' · ')}`;
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

  return (
    <div className="ai-office">
      <header className="ai-office__header">
        <VillageBanner tod={tod} />
        <h2>
          <Crown size={26} className="ai-office__crown" aria-hidden="true" />
          AI 사무실 · 햄스터 마을
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
          <p className="ai-office__calm">지금은 막힌 구성원이 없어요. 평화로운 마을이에요 🌻</p>
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
        <h3>햄스터 마을 현황</h3>
        <p className="ai-office__muted">오늘 일지를 쓰면 도토리가 반짝이고 햄스터가 신나게 뛰어요. 캐릭터를 누르면 상세가 열려요.</p>
        <div className="ai-office__legend">
          {Object.entries(STATUS_COLOR).map(([label, color]) => (
            <span key={label}><i style={{ background: color }} />{label}</span>
          ))}
          <span className="ai-office__clock">{TIME_LABEL[tod]} · {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')} · 마우스를 올리면 시점이 돌아가요</span>
        </div>
        <div className="ai-office__floor">
          <div className="ai-office__room">
            <span className="ai-office__room-name">🏡 햄스터 마을 사무실</span>
            <Office
              agents={agents}
              tod={tod}
              pick={(id) => toggleDetail({ kind: 'member', code: id })}
              bursting={bursting}
              dispatched={dispatched}
              finished={finished}
              activeHelpers={activeHelpers}
              doneHelpers={doneHelpers}
            />
          </div>
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
