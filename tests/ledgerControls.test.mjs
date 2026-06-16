import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ledger control labels and export visibility', () => {
  const source = readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');

  it('shows clarified snapshot refresh label with title and aria-label', () => {
    expect(source).toContain("const LEDGER_SNAPSHOT_REFRESH_LABEL = '조회 데이터 새로고침'");
    expect(source).toContain('저장된 조회용 장부 snapshot을 다시 불러옵니다. 장부 데이터는 수정하지 않습니다.');
    expect(source).toContain('title={LEDGER_SNAPSHOT_REFRESH_TITLE}');
    expect(source).toContain('aria-label={LEDGER_SNAPSHOT_REFRESH_LABEL}');
    expect(source).toContain("{refreshing ? '불러오는 중…' : LEDGER_SNAPSHOT_REFRESH_LABEL}");
  });

  it('removes standalone ledger refresh wording from readonly header', () => {
    const readonlyHeader = source.slice(
      source.indexOf('{ledgerReadOnly ? ('),
      source.indexOf(') : (\n            <>')
    );
    expect(readonlyHeader).not.toContain("'새로고침'");
    expect(readonlyHeader).not.toContain('엑셀로 내보내기');
  });

  it('limits excel export to admin edit access', () => {
    expect(source).toContain('teamAccess.isAdmin && !teamAccess.isMemberScope');
    expect(source).toContain('const canExportLedgerExcel = !isViewer && isAdminEditAccess');
    expect(source).toContain('{canExportLedgerExcel ? (');
    expect(source).toContain('onClick={handleExcelExport}');
  });

  it('keeps publish/download and polling policies unchanged', () => {
    const publishHandler = source.slice(
      source.indexOf('const handlePublishForTeam'),
      source.indexOf('const handleDownloadLedgerBackup')
    );
    expect(source).toMatch(/pollMs:\s*0/);
    expect(source).toContain('autoSyncCloud={false}');
    expect(source).toContain('handleDownloadLedgerBackup');
    expect(source).toContain('지금 조회에 반영');
    expect(source).toContain('장부 JSON 백업 다운로드');
    expect(source).toContain('장부 JSON 백업 가져오기');
    expect(publishHandler).not.toContain('downloadTeamSnapshot');
  });
});
