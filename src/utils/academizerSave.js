/**
 * Save academized .pptx via File System Access API (path picker) or anchor download.
 */

export const ACADEMIZER_SAVE_MODE_KEY = 'tms.academizer.saveMode';

/** @returns {boolean} */
export function supportsSaveFilePicker() {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

/**
 * @returns {'pick'|'download'}
 */
export function readSavedSaveMode() {
  try {
    const raw = localStorage.getItem(ACADEMIZER_SAVE_MODE_KEY);
    if (raw === 'pick' || raw === 'download') return raw;
  } catch {
    /* ignore */
  }
  return supportsSaveFilePicker() ? 'pick' : 'download';
}

/**
 * @param {'pick'|'download'} mode
 */
export function writeSavedSaveMode(mode) {
  try {
    localStorage.setItem(ACADEMIZER_SAVE_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/**
 * @param {Blob} blob
 * @param {string} [filename]
 */
export function downloadBlobViaAnchor(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'academy-deck.pptx';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * @param {Blob} blob
 * @param {string} [filename]
 * @param {{ mode?: 'pick'|'download' }} [options]
 * @returns {Promise<{ method: 'picker'|'download'|'cancelled', name?: string }>}
 */
export async function savePptxBlob(blob, filename, options = {}) {
  const name = filename || 'academy-deck.pptx';
  const mode = options.mode || 'download';

  if (mode === 'pick' && supportsSaveFilePicker()) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [
          {
            description: 'PowerPoint',
            accept: {
              'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { method: 'picker', name: handle.name || name };
    } catch (err) {
      if (err?.name === 'AbortError') {
        return { method: 'cancelled' };
      }
      // Picker unavailable / permission denied → fall back
    }
  }

  downloadBlobViaAnchor(blob, name);
  return { method: 'download', name };
}
