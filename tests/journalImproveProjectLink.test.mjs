import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildKpi02EffectRows } from '../src/utils/computeTeamKpi.js';
import { mergeTaskFromEdit, taskFieldsFromEdit } from '../src/utils/journalTaskFields.js';
import {
  buildImproveProjectRegistrationFromCandidate,
  buildManualImproveProjectRegistration,
  filterImproveProjectsForMember,
  findRegisteredProjectForCandidate,
  formatCandidateMemberSummary,
  formatImproveProjectOwnerLine,
  IMPROVE_PROJECT_SOURCE,
} from '../src/utils/improveProjectLink.js';
import { collectImproveMmCandidates } from '../src/utils/improveProjectCandidates.js';

const IMPROVE_PROJECTS = [
  { id: 'ppt-academizer', name: 'PPT-Academizer', code: 'ppt-acad' },
  {
    id: 'team-kpi',
    name: '팀 KPI 관리시스템',
    code: 'team-kpi',
    ownerMemberId: 'B',
    ownerName: '최우성',
    source: IMPROVE_PROJECT_SOURCE.JOURNAL_CANDIDATE,
    sourceLabel: '2026년 6월 업무일지 후보',
  },
  {
    id: 'tune',
    name: 'tune 기능 고도화',
    code: 'tune',
    ownerMemberId: 'C',
    ownerName: '구성원C',
    source: IMPROVE_PROJECT_SOURCE.JOURNAL_CANDIDATE,
  },
];

describe('improve project link utilities', () => {
  it('builds registration metadata from journal candidate', () => {
    const candidate = {
      title: '팀 KPI 관리시스템',
      sources: [{ memberCode: 'B', dayKey: '2026-06-10' }],
    };
    const reg = buildImproveProjectRegistrationFromCandidate(candidate, { year: 2026, monthIndex: 5 });
    expect(reg.name).toBe('팀 KPI 관리시스템');
    expect(reg.ownerMemberId).toBe('B');
    expect(reg.ownerName).toBe('최우성');
    expect(reg.source).toBe(IMPROVE_PROJECT_SOURCE.JOURNAL_CANDIDATE);
    expect(reg.sourceLabel).toBe('2026년 6월 업무일지 후보');
    expect(reg.sourceJournalRefs).toEqual([{ memberCode: 'B', dayKey: '2026-06-10' }]);
  });

  it('builds manual registration as shared project', () => {
    const reg = buildManualImproveProjectRegistration('수동 과제');
    expect(reg.source).toBe(IMPROVE_PROJECT_SOURCE.MANUAL);
    expect(reg.sourceLabel).toBe('공통/수동 등록');
    expect(reg.ownerMemberId).toBeUndefined();
  });

  it('filters member B to own and shared projects only', () => {
    const visible = filterImproveProjectsForMember(IMPROVE_PROJECTS, 'B');
    const ids = visible.map((p) => p.id);
    expect(ids).toContain('ppt-academizer');
    expect(ids).toContain('team-kpi');
    expect(ids).not.toContain('tune');
  });

  it('filters member C to own and shared projects only', () => {
    const visible = filterImproveProjectsForMember(IMPROVE_PROJECTS, 'C');
    const ids = visible.map((p) => p.id);
    expect(ids).toContain('ppt-academizer');
    expect(ids).toContain('tune');
    expect(ids).not.toContain('team-kpi');
  });

  it('formats owner line for dedicated and shared projects', () => {
    expect(formatImproveProjectOwnerLine(IMPROVE_PROJECTS[1], (c) => c)).toBe(
      '담당/출처: B(최우성)'
    );
    expect(formatImproveProjectOwnerLine(IMPROVE_PROJECTS[0])).toBe('공통/수동 등록');
    expect(formatImproveProjectOwnerLine(buildManualImproveProjectRegistration('x'))).toBe(
      '공통/수동 등록'
    );
  });

  it('summarizes candidate member codes', () => {
    const summary = formatCandidateMemberSummary(
      [{ memberCode: 'B' }, { memberCode: 'B' }, { memberCode: 'C' }],
      (c) => c
    );
    expect(summary).toBe('B · C');
  });

  it('finds registered project by normalized title', () => {
    const candidate = { title: '팀 KPI 관리시스템' };
    expect(findRegisteredProjectForCandidate(candidate, IMPROVE_PROJECTS)?.id).toBe('team-kpi');
  });
});

describe('journal task improve project fields', () => {
  function baseTask(overrides = {}) {
    return {
      id: 't1',
      cat: 'prep',
      title: '개선 업무',
      note: '',
      plan: 2,
      actual: 3,
      done: false,
      ...overrides,
    };
  }

  it('persists improveProjectId and title on save', () => {
    const edit = {
      ...baseTask(),
      dayKey: '2026-06-10',
      improveProjectId: 'team-kpi',
      improveProjectTitle: '팀 KPI 관리시스템',
    };
    const saved = mergeTaskFromEdit(baseTask(), edit);
    expect(saved.improveProjectId).toBe('team-kpi');
    expect(saved.improveProjectTitle).toBe('팀 KPI 관리시스템');
  });

  it('clears improve project link when deselected', () => {
    const existing = baseTask({
      improveProjectId: 'team-kpi',
      improveProjectTitle: '팀 KPI 관리시스템',
    });
    const edit = { ...existing, dayKey: '2026-06-10', improveProjectId: undefined };
    const saved = mergeTaskFromEdit(existing, edit);
    expect(saved.improveProjectId).toBeUndefined();
    expect(saved.improveProjectTitle).toBeUndefined();
  });

  it('does not affect KPI2 effect rows when improveProjectId is set', () => {
    const saved = mergeTaskFromEdit(
      baseTask(),
      {
        ...baseTask(),
        dayKey: '2026-06-10',
        improveProjectId: 'team-kpi',
        improveProjectTitle: '팀 KPI 관리시스템',
        kpi2Effect: { enabled: true, projectId: 'ppt-academizer', baselineHours: 8 },
      }
    );
    const rows = buildKpi02EffectRows(2026, 5, { '2026-06-10': { tasks: [saved] } }, IMPROVE_PROJECTS);
    expect(rows).toHaveLength(1);
    expect(rows[0].업무명).toBe('개선 업무');
  });

  it('tasks without improveProjectId remain valid', () => {
    const fields = taskFieldsFromEdit({ ...baseTask(), dayKey: '2026-06-10' });
    expect(fields.improveProjectId).toBeUndefined();
  });
});

describe('journal improve project UI wiring', () => {
  const journalSource = readFileSync(
    path.join(process.cwd(), 'src/pages/WeeklyJournalPage.jsx'),
    'utf8'
  );
  const kpiPage = readFileSync(path.join(process.cwd(), 'src/pages/TeamKpiPage.jsx'), 'utf8');
  const hookSource = readFileSync(path.join(process.cwd(), 'src/hooks/useImproveProjects.js'), 'utf8');
  const appSource = readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');

  it('shows operating improve projects panel for member journals', () => {
    expect(journalSource).toContain('journal-improve-projects-panel');
    expect(journalSource).toContain('운영 중인 생산성향상 과제');
    expect(journalSource).toContain('아직 연결 가능한 향상 과제가 없습니다');
    expect(journalSource).toContain('filterImproveProjectsForMember');
  });

  it('shows related improve project select in task edit panel', () => {
    expect(journalSource).toContain('관련 향상 과제');
    expect(journalSource).toContain('선택 안 함');
    expect(journalSource).toContain('생산성향상 M/M 또는 KPI2 효과 업무라면');
  });

  it('shows manual shared improve project import on member journal only', () => {
    expect(journalSource).toContain('journal-improve-projects-panel__actions');
    expect(journalSource).toContain('IMPROVE_PROJECTS_IMPORT_HINT');
    expect(journalSource).toContain('loadSharedProjects');
    expect(journalSource).not.toMatch(
      /journal-improve-projects-panel[\s\S]*publishSharedProjects/
    );
  });

  it('shows JSON import fallback on member journal without download button', () => {
    expect(journalSource).toContain('향상 과제 JSON 가져오기');
    expect(journalSource).toContain('importProjectsFromFile');
    expect(journalSource).toContain('IMPROVE_PROJECTS_FILE_IMPORT_HINT');
    expect(journalSource).toContain('IMPROVE_PROJECTS_BLOB_FALLBACK_HINT');
    expect(journalSource).not.toContain('향상 과제 JSON 다운로드');
    expect(journalSource).toContain('관련 향상 과제');
    expect(journalSource).toContain('선택 안 함');
  });

  it('registers candidates with owner metadata on KPI2 tab', () => {
    expect(kpiPage).toContain('buildImproveProjectRegistrationFromCandidate');
    expect(kpiPage).toContain('buildManualImproveProjectRegistration');
    expect(kpiPage).toContain('담당/출처:');
    expect(kpiPage).toContain('운영 목록 등록됨');
    expect(kpiPage).toContain('IMPROVE_PROJECT_LOCAL_SCOPE_NOTICE');
    expect(hookSource).toContain('ownerMemberId');
    expect(hookSource).toContain('sourceLabel');
  });

  it('keeps auto cloud sync disabled and manual-only shared improve project methods', () => {
    expect(appSource).toContain('autoSyncCloud={false}');
    expect(hookSource).toContain('publishSharedProjects');
    expect(hookSource).toContain('loadSharedProjects');
    expect(hookSource).toContain('downloadProjectsFile');
    expect(hookSource).toContain('importProjectsFromFile');
    const localPersistEffect = hookSource.match(
      /useEffect\(\(\) => \{([\s\S]*?)\}, \[projects, readOnly\]\)/
    );
    expect(localPersistEffect?.[1]).toContain('saveImproveProjects(projects)');
    expect(localPersistEffect?.[1] || '').not.toContain('fetchSharedImproveProjectsSnapshot');
    expect(localPersistEffect?.[1] || '').not.toContain('importProjectsFromFile');
    expect(localPersistEffect?.[1] || '').not.toContain('downloadProjectsFile');
  });

  it('collects improve MM candidates for leader KPI display unchanged', () => {
    const rows = collectImproveMmCandidates({
      year: 2026,
      monthIndex: 5,
      getMemberDays: () => ({
        '2026-06-10': {
          tasks: [
            {
              id: 't1',
              cat: 'ai',
              title: '강의자료 자동화',
              plan: 2,
              actual: 3,
              done: true,
            },
          ],
        },
      }),
      memberCodes: ['B'],
      improveProjects: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('강의자료 자동화');
  });
});
