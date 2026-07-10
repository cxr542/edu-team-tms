import { describe, expect, it } from 'vitest';
import { resolveJournalBlobPostEnabled } from '../src/constants/journalBlobShare.js';

describe('journal Blob POST demote (J7d)', () => {
  it('demotes Blob POST by default when MANUAL_MIRROR is on', () => {
    expect(
      resolveJournalBlobPostEnabled({
        explicitEnv: '',
        manualMirrorEnabled: true,
      })
    ).toBe(false);
  });

  it('keeps Blob POST on when MANUAL_MIRROR is off', () => {
    expect(
      resolveJournalBlobPostEnabled({
        explicitEnv: '',
        manualMirrorEnabled: false,
      })
    ).toBe(true);
  });

  it('allows explicit rollback to re-enable Blob POST', () => {
    expect(
      resolveJournalBlobPostEnabled({
        explicitEnv: 'true',
        manualMirrorEnabled: true,
      })
    ).toBe(true);
    expect(
      resolveJournalBlobPostEnabled({
        explicitEnv: 'false',
        manualMirrorEnabled: false,
      })
    ).toBe(false);
  });
});
