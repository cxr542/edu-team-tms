/** Progress-stepper helpers for the PPT academizer page. */

export const FLOW_STEPS = [
  { emoji: '📤', label: '업로드' },
  { emoji: '🔍', label: '분석' },
  { emoji: '✨', label: '변환' },
  { emoji: '📥', label: '다운로드' },
];

/**
 * Index of the step the user is on; steps before it are done, and FLOW_STEPS.length means all done.
 * @param {{ file: unknown, wizardData: unknown, step: number, lastResult: unknown }} s
 */
export function flowCurrent({ file, wizardData, step, lastResult }) {
  if (lastResult) return FLOW_STEPS.length;
  if (step === 2) return 2;
  if (wizardData) return 2;
  if (file) return 1;
  return 0;
}

/** @param {string} name */
export function fileKind(name) {
  return /\.html?$/i.test(name || '') ? 'HTML' : 'PPTX';
}

/** @param {number} bytes */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
