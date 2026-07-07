/** 5월 파일럿 샘플 (프로토타입과 동기) */
export const JOURNAL_SEED_MAY_2026 = {
  '2026-05-04': { holiday: false, mm: { work: 0, improve: 0, leave: 0 }, tasks: [] },
  '2026-05-05': { holiday: true, mm: { work: 0, improve: 0, leave: 1 }, tasks: [] },
  '2026-05-06': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0 },
    tasks: [
      { id: 't1', cat: 'other', title: '주간회의록 작성', plan: 1, actual: 0.5, done: true, note: '' },
    ],
  },
  '2026-05-07': { holiday: false, mm: { work: 0, improve: 0, leave: 0 }, tasks: [] },
  '2026-05-08': { holiday: false, mm: { work: 0, improve: 0, leave: 0 }, tasks: [] },
  '2026-05-11': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0 },
    tasks: [{ id: 't2', cat: 'ai', title: '팀 KPI 구상', plan: 2, actual: 2, done: true, note: '' }],
  },
  '2026-05-12': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0 },
    tasks: [
      { id: 't3', cat: 'other', title: '팀 KPI 관련 팀 내부 회의', plan: 1, actual: 1, done: true, note: '' },
      { id: 't4', cat: 'prep', title: '5월 신규입사자 온보딩 교육 준비', plan: 3, actual: 2.5, done: true, note: '' },
    ],
  },
  '2026-05-13': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0 },
    tasks: [
      { id: 't5', cat: 'edu', title: '5월 신규입사자 온보딩', plan: 6, actual: 5.5, done: true, note: '' },
      { id: 't6', cat: 'other', title: '주간회의록 작성', plan: 1, actual: 0.5, done: true, note: '' },
    ],
  },
  '2026-05-14': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0 },
    tasks: [
      { id: 't7', cat: 'other', title: '창립기념일 행사', plan: 2, actual: 2, done: true, note: '' },
      { id: 't8', cat: 'edu', title: '5월 신규입사자 온보딩', plan: 4, actual: 4, done: true, note: '' },
    ],
  },
  '2026-05-15': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0.5 },
    tasks: [
      { id: 't9', cat: 'other', title: '오후 반차', plan: 0, actual: 0, done: true, note: '휴일 M/M 0.5' },
    ],
  },
  '2026-05-18': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0 },
    tasks: [
      { id: 't10', cat: 'prep', title: '기술파트너사 교육', plan: 4, actual: 3, done: false, note: '' },
      { id: 't11', cat: 'ai', title: 'PPT-아카데마이저', plan: 2, actual: 1.5, done: false, note: '' },
    ],
  },
  '2026-05-19': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0 },
    tasks: [
      { id: 't12', cat: 'prep', title: '기술파트너사 교육', plan: 4, actual: 4, done: true, note: '' },
      { id: 't13', cat: 'ai', title: 'PPT-아카데마이저', plan: 2, actual: 2, done: true, note: '' },
      { id: 't14', cat: 'other', title: '팀 KPI 승인 요청', plan: 0.5, actual: 0.5, done: true, note: '' },
    ],
  },
  '2026-05-20': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0 },
    tasks: [
      {
        id: 't15',
        cat: 'edu',
        title: '골드/플래티넘 파트너사 교육',
        plan: 8,
        actual: 6,
        done: true,
        note: 'OpenStack, Ceph',
      },
      { id: 't16', cat: 'other', title: '주간회의록 작성', plan: 1, actual: 0.5, done: true, note: '' },
    ],
  },
  '2026-05-21': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0 },
    tasks: [
      {
        id: 't17',
        cat: 'edu',
        title: '골드/플래티넘 파트너사 교육',
        plan: 8,
        actual: 8,
        done: true,
        note: 'K8s, CONTRABASS',
      },
    ],
  },
  '2026-05-22': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0 },
    tasks: [
      {
        id: 't18',
        cat: 'edu',
        title: '골드/플래티넘 파트너사 교육',
        plan: 8,
        actual: 8,
        done: true,
        note: 'CONTRABASS 실습',
      },
    ],
  },
  '2026-05-25': { holiday: true, mm: { work: 0, improve: 0, leave: 1 }, tasks: [] },
  '2026-05-26': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0 },
    tasks: [
      { id: 't19', cat: 'edu', title: 'OKESTRO Solution 딥다이브 교육', plan: 8, actual: 8, done: true, note: '' },
    ],
  },
  '2026-05-27': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0 },
    tasks: [
      {
        id: 't20',
        cat: 'edu',
        title: '파트너사 정기 교육',
        plan: 8,
        actual: 8,
        done: true,
        note: 'CONTRABASS, VIOLA',
      },
      {
        id: 't21',
        cat: 'other',
        title: '주간회의록 작성',
        plan: 1,
        actual: 0,
        done: true,
        note: '교육 진행 중·간헐 작성 (실작업 0h)',
      },
    ],
  },
  '2026-05-28': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0 },
    tasks: [
      {
        id: 't22',
        cat: 'edu',
        title: '파트너사 정기 교육',
        plan: 6,
        actual: 5.5,
        done: true,
        note: 'CONTRABASS, VIOLA',
      },
    ],
  },
  '2026-05-29': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0 },
    tasks: [
      { id: 't23', cat: 'other', title: '강의일지 작성', plan: 1, actual: 1, done: true, note: '' },
      { id: 't24', cat: 'other', title: 'CMP Hands-on 산정', plan: 0.5, actual: 0.5, done: true, note: '' },
      { id: 't25', cat: 'ai', title: 'TMS 수정 및 보완', plan: 3, actual: 2, done: false, note: '' },
    ],
  },
};
