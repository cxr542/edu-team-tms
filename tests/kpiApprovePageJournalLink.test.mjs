import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('KpiApprovePage journal link', () => {
  const source = readFileSync(path.join(process.cwd(), 'src/pages/KpiApprovePage.jsx'), 'utf8');

  it('renders 업무일지 보기 link on each pending approval card', () => {
    expect(source).toContain('업무일지 보기');
    expect(source).toContain('AppModuleLink');
    expect(source).toContain('module="journal"');
    expect(source).toContain('access={URL_ACCESS_ADMIN}');
    expect(source).toContain('member={item.member.code}');
    expect(source).toContain('year={year}');
    expect(source).toContain('month={month + 1}');
  });

  it('keeps approve and reject buttons intact', () => {
    expect(source).toContain('승인');
    expect(source).toContain('반려');
    expect(source).toContain('approveKpi1(year, month, item.member.code)');
    expect(source).toContain('approveKpi2Row(item.member.code, item.dayKey, item.taskId)');
    expect(source).toContain('setRejecting(item)');
  });
});
