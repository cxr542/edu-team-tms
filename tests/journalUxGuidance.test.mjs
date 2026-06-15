import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('journal UX guidance', () => {
  const journalSource = readFileSync(
    path.join(process.cwd(), 'src/pages/WeeklyJournalPage.jsx'),
    'utf8'
  );
  const appSource = readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');
  const cssSource = readFileSync(
    path.join(process.cwd(), 'src/pages/WeeklyJournalPage.css'),
    'utf8'
  );

  it('shows date/status panel and member scope title for B/C journal URLs', () => {
    expect(journalSource).toContain('journal-status-panel');
    expect(journalSource).toContain('formatJournalDayHeading');
    expect(journalSource).toContain('오늘 작성 중');
    expect(journalSource).toContain('describeFocusDayTasks');
    expect(journalSource).toContain('구성원 <strong>{memberCode}</strong> 업무일지');
  });

  it('clarifies local save vs team shared save/import buttons', () => {
    expect(journalSource).toContain('팀 공유본 가져오기');
    expect(journalSource).toContain('팀 공유 저장');
    expect(journalSource).toContain('이 브라우저에 저장');
    expect(journalSource).toContain('저장은 이 브라우저에 먼저 반영됩니다.');
    expect(journalSource).toContain('자동 공유 저장은 사용하지 않습니다.');
  });

  it('documents M/M and KPI2 meaning with done-gated MM logic', () => {
    expect(journalSource).toContain('journal-kpi-help');
    expect(journalSource).toContain('일반 업무 M/M');
    expect(journalSource).toContain('생산성향상 M/M');
    expect(journalSource).toContain('개선 효과로 제출할 항목만 체크합니다.');
    expect(journalSource).toContain('완료 체크한 업무의 실작업(h)만 M/M·가동률');
    expect(journalSource).toContain('kpi2EffectDone');
  });

  it('shows member journal tabs for all roles including locked members', () => {
    expect(journalSource).toContain('journal-member-tabs');
    expect(journalSource).toContain('canEditMemberJournal');
    expect(journalSource).toContain('viewingOtherMember');
    expect(journalSource).toContain('조회용 JSON 가져오기');
    expect(journalSource).toContain('importJournalViewOnlyBackup');
  });

  it('styles status and help panels', () => {
    expect(cssSource).toContain('.journal-status-panel');
    expect(cssSource).toContain('.journal-kpi-help');
    expect(cssSource).toContain('.journal-field-help');
  });

  it('keeps journal auto cloud sync disabled', () => {
    expect(appSource).toContain('autoSyncCloud={false}');
    expect(appSource).not.toMatch(/autoSyncCloud=\{true\}/);
  });

  it('preserves kpi2Effect save path and member ledger/public viewer policies', () => {
    expect(journalSource).toContain('kpi2Effect');
    expect(appSource).toContain('PublicViewerGuidePage');
    expect(appSource).toContain('isPublicViewerScope');
    expect(appSource).toContain('canEditLedgerNow');
  });

  it('shows operating improve projects and link select for member journals', () => {
    expect(journalSource).toContain('journal-improve-projects-panel');
    expect(journalSource).toContain('운영 중인 생산성향상 과제');
    expect(journalSource).toContain('관련 향상 과제');
    expect(journalSource).toContain('IMPROVE_PROJECT_JOURNAL_SCOPE_NOTICE');
    expect(cssSource).toContain('.journal-improve-projects-panel');
  });
});
