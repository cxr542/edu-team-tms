import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('KPI2 productivity navigation', () => {
  const kpiPage = readFileSync(path.join(process.cwd(), 'src/pages/TeamKpiPage.jsx'), 'utf8');
  const kpiCss = readFileSync(path.join(process.cwd(), 'src/pages/TeamKpiPage.css'), 'utf8');
  const appSource = readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');

  it('shows KPI2 context on overview card and detail title', () => {
    expect(kpiPage).toContain('team-kpi-card-kpi-tag');
    expect(kpiPage).toContain('KPI2 · 생산성향상 관리');
    expect(kpiPage).toContain('생산성향상 후보와 효과 제출을 관리합니다.');
    expect(kpiPage).toContain('KPI2 상세보기 →');
    expect(kpiPage).toContain('KPI2 · 생산성향상 도구/과제 관리');
    expect(kpiPage).toContain('team-kpi-section-lead');
  });

  it('adds back navigation to member overview without URL reload', () => {
    expect(kpiPage).toContain('team-kpi-back-btn');
    expect(kpiPage).toContain('구성원 개요로 돌아가기');
    expect(kpiPage).toContain("onClick={() => setTab('overview')}");
    expect(kpiPage).not.toContain("window.location");
  });

  it('labels KPI2 tab with aria guidance', () => {
    expect(kpiPage).toContain('ariaLabel: `${KPI2_NAME} (KPI2 · 생산성향상 관리)`');
    expect(kpiPage).toContain('aria-label={t.ariaLabel || t.label}');
  });

  it('styles back button and keeps improve project sections', () => {
    expect(kpiCss).toContain('.team-kpi-back-btn');
    expect(kpiPage).toContain('업무일지에서 발견된 후보');
    expect(kpiPage).toContain('운영 중인 생산성향상 도구/과제');
    expect(kpiPage).toContain('KPI2 운영 목록에 등록');
  });

  it('preserves registration logic and regression policies', () => {
    expect(kpiPage).toContain('improveProjectsApi.addProject');
    expect(appSource).toContain('autoSyncCloud={false}');
    expect(appSource).toContain('PublicViewerGuidePage');
    expect(appSource).toContain('canEditLedgerNow');
  });
});
