import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACADEMIZER_SAVE_MODE_KEY,
  readSavedSaveMode,
  savePptxBlob,
  supportsSaveFilePicker,
  writeSavedSaveMode,
} from '../src/utils/academizerSave.js';

function installMemoryLocalStorage() {
  /** @type {Map<string, string>} */
  const store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      store.set(String(k), String(v));
    },
    removeItem: (k) => {
      store.delete(k);
    },
  });
  return store;
}

beforeEach(() => {
  installMemoryLocalStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('academizerSave', () => {
  it('detects save file picker support', () => {
    vi.stubGlobal('showSaveFilePicker', undefined);
    expect(supportsSaveFilePicker()).toBe(false);
    vi.stubGlobal('showSaveFilePicker', vi.fn());
    expect(supportsSaveFilePicker()).toBe(true);
  });

  it('defaults save mode to pick when picker exists', () => {
    vi.stubGlobal('showSaveFilePicker', vi.fn());
    expect(readSavedSaveMode()).toBe('pick');
  });

  it('persists save mode', () => {
    writeSavedSaveMode('download');
    expect(localStorage.getItem(ACADEMIZER_SAVE_MODE_KEY)).toBe('download');
    expect(readSavedSaveMode()).toBe('download');
  });

  it('saves via picker when mode is pick', async () => {
    const close = vi.fn();
    const write = vi.fn();
    const createWritable = vi.fn(async () => ({ write, close }));
    const showSaveFilePicker = vi.fn(async () => ({
      name: 'out.pptx',
      createWritable,
    }));
    vi.stubGlobal('showSaveFilePicker', showSaveFilePicker);

    const blob = new Blob(['x'], { type: 'application/octet-stream' });
    const result = await savePptxBlob(blob, 'academy.pptx', { mode: 'pick' });
    expect(result).toEqual({ method: 'picker', name: 'out.pptx' });
    expect(write).toHaveBeenCalledWith(blob);
    expect(close).toHaveBeenCalled();
  });

  it('returns cancelled when user aborts picker', async () => {
    const err = new Error('abort');
    err.name = 'AbortError';
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn(async () => {
        throw err;
      })
    );
    const result = await savePptxBlob(new Blob(['x']), 'a.pptx', { mode: 'pick' });
    expect(result.method).toBe('cancelled');
  });

  it('uses download mode without picker', async () => {
    vi.stubGlobal('showSaveFilePicker', undefined);
    const click = vi.fn();
    const anchor = { click, href: '', download: '' };
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
    });
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:mock',
      revokeObjectURL: vi.fn(),
    });

    const result = await savePptxBlob(new Blob(['x']), 'a.pptx', { mode: 'download' });
    expect(result.method).toBe('download');
    expect(click).toHaveBeenCalled();
  });
});
