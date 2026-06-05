/**
 * PPT-Academizer KPI 데모 (2026-06)
 * - 6/8~12: 개발 2h/일(월~금) · 생산향상 M/M · KPI2 효과 OFF
 * - 6/16: 활용 1건 · kpi2Effect ON (기준 8h · 실 5h)
 */
const devTask = (id, dayLabel) => ({
  id,
  cat: 'ai',
  title: 'PPT-Academizer 개발',
  plan: 2,
  actual: 2,
  done: true,
  mmAxis: 'improve',
  note: `시나리오: 개발 주 ${dayLabel} · KPI2 효과 미적용`,
});

export const JOURNAL_SEED_ACADEMIZER_SCENARIO = {
  '2026-06-08': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0 },
    tasks: [devTask('acad-dev-mon', '월')],
  },
  '2026-06-09': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0 },
    tasks: [devTask('acad-dev-tue', '화')],
  },
  '2026-06-10': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0 },
    tasks: [devTask('acad-dev-wed', '수')],
  },
  '2026-06-11': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0 },
    tasks: [devTask('acad-dev-thu', '목')],
  },
  '2026-06-12': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0 },
    tasks: [devTask('acad-dev-fri', '금')],
  },
  '2026-06-16': {
    holiday: false,
    mm: { work: 0, improve: 0, leave: 0 },
    tasks: [
      {
        id: 'acad-use-tue',
        cat: 'prep',
        title: 'PPT 신규 작성 (Academizer, 20장)',
        plan: 8,
        actual: 5,
        done: true,
        note: '시나리오: 활용 주 · KPI2 효과 적용',
        kpi2Effect: { enabled: true, projectId: 'ppt-academizer', baselineHours: 8 },
      },
    ],
  },
};

/** KPI 탭 주간메모 샘플 (6월 2·3주차 = w2, w3) */
export const KPI_WEEK_MEMOS_ACADEMIZER_SCENARIO = {
  w2: 'PPT-Academizer 개발 집중 (일 2h × 5일, 생산향상 M/M)',
  w3: 'Academizer로 PPT 제작 — KPI2 효과 1건 (8h→5h)',
};

/** 샘플 되돌리기 시 KPI2 개요·집계에 반영할 데모 승인 (6/16 활용 건) */
export const ACADEMIZER_DEMO_KPI2_APPROVALS = [{ dayKey: '2026-06-16', taskId: 'acad-use-tue' }];
