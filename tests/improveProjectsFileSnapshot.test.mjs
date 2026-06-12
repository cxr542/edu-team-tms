import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildImproveProjectsSnapshot } from '../api/utils/improveProjectsSnapshotCore.js';
import {
  buildImproveProjectsFileSnapshot,
  downloadImproveProjectsSnapshot,
  formatImproveProjectsFileName,
  IMPROVE_PROJECTS_FILE_SNAPSHOT_SOURCE,
  mergeImproveProjectsFromSnapshot,
  parseImproveProjectsSnapshotFile,
  readImproveProjectsSnapshotFile,
} from '../src/utils/improveProjectsFileSnapshot.js';

describe('improveProjectsFileSnapshot utilities', () => {
  it('builds file snapshot with schema and meta', () => {
    const snapshot = buildImproveProjectsFileSnapshot([
      { id: 'a', name: 'A 과제', code: 'a-code', ownerMemberId: 'B' },
    ]);
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.source).toBe(IMPROVE_PROJECTS_FILE_SNAPSHOT_SOURCE);
    expect(snapshot.projects).toHaveLength(1);
    expect(snapshot.meta.projectCount).toBe(1);
    expect(snapshot.meta.exportedBy).toBe('json-download');
    expect(snapshot.publishedAt).toMatch(/^\d{4}-/);
  });

  it('preserves unknown fields on projects', () => {
    const snapshot = buildImproveProjectsFileSnapshot([
      { id: 'x', name: '테스트', code: 'x', customFlag: true },
    ]);
    expect(snapshot.projects[0].customFlag).toBe(true);
  });

  it('formats download filename', () => {
    const name = formatImproveProjectsFileName(new Date('2026-06-12T14:05:00'));
    expect(name).toBe('edu-tms-improve-projects-2026-06-12-1405.json');
    expect(name).toMatch(/^edu-tms-improve-projects-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
  });

  it('parses valid file snapshot JSON', () => {
    const raw = buildImproveProjectsFileSnapshot([{ id: 'a', name: 'A', code: 'a' }]);
    const parsed = parseImproveProjectsSnapshotFile(JSON.stringify(raw));
    expect(parsed.ok).toBe(true);
    expect(parsed.snapshot.projects).toHaveLength(1);
    expect(parsed.snapshot.source).toBe(IMPROVE_PROJECTS_FILE_SNAPSHOT_SOURCE);
  });

  it('parses valid Blob snapshot schema JSON', () => {
    const raw = buildImproveProjectsSnapshot([{ id: 'b', name: 'B', code: 'b' }]);
    const parsed = parseImproveProjectsSnapshotFile(JSON.stringify(raw));
    expect(parsed.ok).toBe(true);
    expect(parsed.snapshot.projects).toHaveLength(1);
    expect(parsed.snapshot.source).toBe('team-kpi-improve-projects');
  });

  it('rejects invalid JSON', () => {
    expect(parseImproveProjectsSnapshotFile('{bad').ok).toBe(false);
  });

  it('rejects payload without projects array', () => {
    expect(parseImproveProjectsSnapshotFile(JSON.stringify({ schemaVersion: 1 })).ok).toBe(false);
  });

  it('rejects malformed projects safely', () => {
    const parsed = parseImproveProjectsSnapshotFile(
      JSON.stringify({
        schemaVersion: 1,
        projects: [{ name: 'no id' }],
      })
    );
    expect(parsed.ok).toBe(false);
  });

  it('merges file projects with local-only retention and file priority', () => {
    const local = [
      { id: 'local-only', name: '로컬 전용', code: 'local-only', localTag: 'keep' },
      { id: 'shared', name: '구 이름', code: 'shared', ownerMemberId: 'B' },
    ];
    const file = [
      { id: 'shared', name: '새 이름', code: 'shared', sourceLabel: 'file' },
      { id: 'file-only', name: '파일 전용', code: 'file-only' },
    ];
    const merged = mergeImproveProjectsFromSnapshot(local, file);
    expect(merged.find((p) => p.id === 'local-only')?.localTag).toBe('keep');
    expect(merged.find((p) => p.id === 'shared')?.name).toBe('새 이름');
    expect(merged.find((p) => p.id === 'file-only')?.name).toBe('파일 전용');
    expect(merged).toHaveLength(3);
  });

  it('download helper does not call fetch or cloud API routes', () => {
    const utilSource = readFileSync(
      path.join(process.cwd(), 'src/utils/improveProjectsFileSnapshot.js'),
      'utf8'
    );
    expect(utilSource).not.toMatch(/\bfetch\s*\(/);
    expect(utilSource).not.toMatch(/\/api\/improve-projects-snapshot/);
    expect(utilSource).not.toMatch(/@vercel\/blob/);
    const snapshot = buildImproveProjectsFileSnapshot([{ id: 'a', name: 'A', code: 'a' }]);
    expect(snapshot.meta.projectCount).toBe(1);
    expect(typeof downloadImproveProjectsSnapshot).toBe('function');
  });

  it('readImproveProjectsSnapshotFile uses FileReader only', () => {
    const utilSource = readFileSync(
      path.join(process.cwd(), 'src/utils/improveProjectsFileSnapshot.js'),
      'utf8'
    );
    expect(utilSource).toContain('FileReader');
    expect(utilSource).not.toMatch(/\bfetch\s*\(/);
    const raw = buildImproveProjectsFileSnapshot([{ id: 'c', name: 'C', code: 'c' }]);
    const parsed = parseImproveProjectsSnapshotFile(JSON.stringify(raw));
    expect(parsed.ok).toBe(true);
    expect(parsed.snapshot.projects[0].id).toBe('c');
    expect(readImproveProjectsSnapshotFile).toBeTypeOf('function');
  });
});
