import { strToU8, zipSync } from 'fflate';
import { guideFileName } from './downloadHtml';

/** ZIP 안에서 같은 이름이 겹치면 " (2)" 를 붙인다. */
function uniqueName(name, used) {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 2; ; i += 1) {
    const next = `${stem} (${i})${ext}`;
    if (!used.has(next)) {
      used.add(next);
      return next;
    }
  }
}

/**
 * 강의가이드 전체를 ZIP 으로 묶는다.
 * @param {{ folder: string, title: string, load: () => Promise<string> }[]} items
 * @returns {Promise<{ blob: Blob, count: number, failed: string[] }>}
 */
export async function buildGuideZip(items) {
  const files = {};
  const used = new Set();
  const failed = [];
  for (const item of items) {
    const html = await Promise.resolve()
      .then(() => item.load())
      .catch(() => '');
    if (!html) {
      failed.push(item.title);
      continue;
    }
    const folder = guideFileName(item.folder, 'guides').replace(/\.html$/, '');
    const path = uniqueName(`${folder}/${guideFileName(item.title)}`, used);
    files[path] = strToU8(html);
  }
  const count = Object.keys(files).length;
  const zipped = zipSync(files, { level: 6 });
  return { blob: new Blob([zipped], { type: 'application/zip' }), count, failed };
}

export function downloadBlob(fileName, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
