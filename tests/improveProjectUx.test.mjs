import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('improve project management UX', () => {
  const kpiPage = readFileSync(path.join(process.cwd(), 'src/pages/TeamKpiPage.jsx'), 'utf8');
  const kpiCss = readFileSync(path.join(process.cwd(), 'src/pages/TeamKpiPage.css'), 'utf8');
  const appSource = readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');
  const candidatesSource = readFileSync(
    path.join(process.cwd(), 'src/utils/improveProjectCandidates.js'),
    'utf8'
  );

  it('shows flow guidance and separates candidates from operating list on KPI2 tab', () => {
    expect(kpiPage).toContain('team-kpi-improve-flow');
    expect(kpiPage).toContain('업무일지에서 발견된 후보');
    expect(kpiPage).toContain('운영 중인 생산성향상 도구/과제');
    expect(kpiPage).toContain('team-kpi-projects-panel');
    expect(kpiPage).toContain('KPI2 · 생산성향상 도구/과제 관리');
  });

  it('clarifies register button and duplicate guidance', () => {
    expect(kpiPage).toContain('KPI2 운영 목록에 등록');
    expect(kpiPage).toContain('이미 운영 목록에 있음');
    expect(kpiPage).toContain('운영 목록 등록됨');
    expect(kpiPage).toContain('원본 일지를 수정하지 않습니다');
  });

  it('shows owner/source on candidates and operating list', () => {
    expect(kpiPage).toContain('담당/출처:');
    expect(kpiPage).toContain('업무일지 후보');
    expect(kpiPage).toContain('formatImproveProjectOwnerLine');
    expect(kpiPage).toContain('IMPROVE_PROJECT_LOCAL_SCOPE_NOTICE');
    expect(kpiPage).toContain('buildManualImproveProjectRegistration');
  });

  it('explains KPI2 effect is not automatic from improve MM', () => {
    expect(kpiPage).toContain('효과 제출 관리');
    expect(kpiPage).toContain('KPI2 효과가 되지는 않습니다');
    expect(kpiPage).toContain('로 체크한 항목만 표시');
  });

  it('documents completion status separate from MM aggregation', () => {
    expect(kpiPage).toContain('M/M 집계와는 별개입니다');
  });

  it('supports includeRegistered for display without changing default candidate filter', () => {
    expect(candidatesSource).toContain('includeRegistered = false');
    expect(kpiPage).toContain('includeRegistered: true');
    expect(kpiPage).toContain('improveMmRegistered');
  });

  it('styles flow, operating list, and KPI2 effect sections', () => {
    expect(kpiCss).toContain('.team-kpi-improve-flow');
    expect(kpiCss).toContain('.team-kpi-projects-panel');
    expect(kpiCss).toContain('.team-kpi-kpi2-effects');
    expect(kpiCss).toContain('.team-kpi-local-scope-notice');
    expect(kpiCss).toContain('.team-kpi-project-row');
  });

  it('preserves journal auto sync off and ledger/public viewer policies', () => {
    expect(appSource).toContain('autoSyncCloud={false}');
    expect(appSource).toContain('PublicViewerGuidePage');
    expect(appSource).toContain('canEditLedgerNow');
  });
});
