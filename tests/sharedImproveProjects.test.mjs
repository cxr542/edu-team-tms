import { describe, expect, it } from 'vitest';
import {
  buildImproveProjectsSnapshot,
  createEmptyImproveProjectsSnapshot,
  mergeImproveProjects,
  normalizeImproveProjectEntry,
  normalizeImproveProjectsSnapshot,
  validateImproveProjectsPayload,
} from '../server/api-utils/improveProjectsSnapshotCore.js';
import { IMPROVE_PROJECTS_LIVE_PATH } from '../src/utils/improveProjectsCloudSnapshot.js';

describe('improveProjectsCloudSnapshot utilities', () => {
  it('builds snapshot with schema and meta', () => {
    const snapshot = buildImproveProjectsSnapshot([
      { id: 'a', name: 'A 과제', code: 'a-code' },
    ]);
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.source).toBe('team-kpi-improve-projects');
    expect(snapshot.projects).toHaveLength(1);
    expect(snapshot.meta.projectCount).toBe(1);
    expect(snapshot.publishedAt).toMatch(/^\d{4}-/);
  });

  it('normalizes empty snapshot', () => {
    const empty = createEmptyImproveProjectsSnapshot();
    expect(empty.projects).toEqual([]);
    expect(empty.source).toBe('team-kpi-improve-projects');
    expect(empty.meta.publishedBy).toBeNull();
  });

  it('preserves unknown fields on project entries', () => {
    const entry = normalizeImproveProjectEntry({
      id: 'x',
      name: '테스트',
      code: 'x',
      customFlag: true,
      ownerMemberId: 'B',
    });
    expect(entry.customFlag).toBe(true);
    expect(entry.ownerMemberId).toBe('B');
  });

  it('rejects invalid payload', () => {
    expect(validateImproveProjectsPayload(null).ok).toBe(false);
    expect(validateImproveProjectsPayload([{ name: 'no id' }]).ok).toBe(false);
    expect(validateImproveProjectsPayload([
      { id: 'a', name: 'A', code: 'a' },
      { id: 'a', name: 'dup', code: 'a' },
    ]).ok).toBe(false);
  });

  it('merges remote additions and updates while keeping local-only items', () => {
    const local = [
      { id: 'local-only', name: '로컬 전용', code: 'local-only', localTag: 'keep' },
      { id: 'shared', name: '구 이름', code: 'shared', ownerMemberId: 'B' },
    ];
    const remote = [
      { id: 'shared', name: '새 이름', code: 'shared', ownerMemberId: 'B', sourceLabel: 'remote' },
      { id: 'remote-only', name: '원격 전용', code: 'remote-only' },
    ];
    const merged = mergeImproveProjects(local, remote);
    expect(merged.find((p) => p.id === 'local-only')?.localTag).toBe('keep');
    expect(merged.find((p) => p.id === 'shared')?.name).toBe('새 이름');
    expect(merged.find((p) => p.id === 'shared')?.sourceLabel).toBe('remote');
    expect(merged.find((p) => p.id === 'remote-only')?.name).toBe('원격 전용');
    expect(merged).toHaveLength(3);
  });

  it('uses live-latest path constant only', () => {
    expect(IMPROVE_PROJECTS_LIVE_PATH).toBe('improve-projects/live-latest.json');
    expect(IMPROVE_PROJECTS_LIVE_PATH).not.toMatch(/live-\d/);
  });

  it('server core has no browser-only globals', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const core = readFileSync(
      join(process.cwd(), 'server/api-utils/improveProjectsSnapshotCore.js'),
      'utf8'
    );
    expect(core).not.toMatch(/\bwindow\b|\blocalStorage\b|\bnavigator\b/);
  });

  it('normalizes malformed snapshot safely', () => {
    const normalized = normalizeImproveProjectsSnapshot({ foo: 'bar' });
    expect(normalized.projects).toEqual([]);
    expect(normalized.meta.app).toBe('edu-team-tms');
  });
});
