/**
 * Save academized .pptx via File System Access API (path picker) or anchor download.
 */

export const ACADEMIZER_SAVE_MODE_KEY = 'tms.academizer.saveMode';

function getShowSaveFilePicker() {
  const g = typeof globalThis !== 'undefined' ? globalThis : null;
  return typeof g?.showSaveFilePicker === 'function' ? g.showSaveFilePicker.bind(g) : null;
}

/** @returns {boolean} */
export function supportsSaveFilePicker() {
  return getShowSaveFilePicker() != null;
}

/**
 * @returns {'pick'|'download'}
 */
export function readSavedSaveMode() {
  try {
    const raw = globalThis.localStorage?.getItem?.(ACADEMIZER_SAVE_MODE_KEY);
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
    globalThis.localStorage?.setItem?.(ACADEMIZER_SAVE_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/**
 * @param {Blob} blob
 * @param {string} [filename]
 */
export function downloadBlobViaAnchor(blob, filename) {
  const doc = globalThis.document;
  if (!doc?.createElement) {
    throw new Error('document is not available for download');
  }
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
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
  const showSaveFilePicker = getShowSaveFilePicker();

  if (mode === 'pick' && showSaveFilePicker) {
    try {
      const handle = await showSaveFilePicker({
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
