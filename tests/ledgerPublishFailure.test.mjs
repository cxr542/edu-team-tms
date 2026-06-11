import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  describeLedgerPublishFailure,
  isLedgerQuotaFailure,
  shouldBlockLiveLedgerPublish,
} from '../src/utils/ledgerPublishUi.js';

describe('describeLedgerPublishFailure', () => {
  it('returns quota guidance without implying backup download happened', () => {
    const result = describeLedgerPublishFailure({
      ok: false,
      reason: 'quota-exceeded',
      message: 'blob-quota-exceeded',
    });
    expect(result.isQuota).toBe(true);
    expect(result.blockLivePublish).toBe(true);
    expect(result.userMessage).toContain('Blob 한도 제한');
    expect(result.userMessage).not.toContain('저장했습니다');
  });

  it('returns generic failure copy for server errors', () => {
    const result = describeLedgerPublishFailure({
      ok: false,
      reason: '500',
      message: 'internal error',
    });
    expect(result.isQuota).toBe(false);
    expect(result.userMessage).toContain('로컬 저장은 유지됩니다');
  });
});

describe('isLedgerQuotaFailure', () => {
  it('detects cloud-limited guard failures', () => {
    expect(isLedgerQuotaFailure({ reason: 'cloud-limited' })).toBe(true);
    expect(shouldBlockLiveLedgerPublish({ reason: 'not-configured' })).toBe(true);
  });
});

describe('publish button policy in App', () => {
  it('does not download JSON on publish failure', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');
    const handler = source.slice(
      source.indexOf('const handlePublishForTeam'),
      source.indexOf('const handleDownloadLedgerBackup')
    );
    expect(handler).not.toContain('downloadTeamSnapshot');
    expect(handler).not.toContain('markPublishedLocally');
  });

  it('exposes an explicit backup download button', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');
    expect(source).toContain('장부 JSON 백업 다운로드');
    expect(source).toContain('handleDownloadLedgerBackup');
  });
});
