/**
 * 릴리즈노트 누락분 점검 (읽기 전용 순수 로직).
 * 머지된 PR 중 릴리즈노트에 `PR #N` 이 없는 것을 찾는다.
 * release-notes-on-merge 워크플로가 건너뛰는 PR(docs(release): 제목, 봇 작성)은 누락으로 보지 않는다.
 */

export const RELEASE_NOTE_CHECK_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 릴리즈노트 본문에 적힌 PR 번호 집합 */
export function extractNotedPrNumbers(noteText) {
  const found = new Set();
  for (const match of String(noteText || '').matchAll(/PR\s*#(\d+)/g)) {
    found.add(Number(match[1]));
  }
  return found;
}

/** 워크플로(release-notes-on-merge.yml)가 릴리즈노트 항목을 만들지 않는 PR */
export function isSkippedByWorkflow(pr) {
  const title = String(pr?.title || '');
  const author = String(pr?.user?.login || pr?.author || '');
  return title.startsWith('docs(release):') || author === 'github-actions[bot]';
}

/**
 * @param {{ prs: Array<{number:number,title:string,merged_at?:string|null,html_url?:string,user?:{login?:string}}>, noteText: string, now?: Date, days?: number }} input
 */
export function findMissingReleaseNotes({ prs, noteText, now = new Date(), days = RELEASE_NOTE_CHECK_DAYS }) {
  const noted = extractNotedPrNumbers(noteText);
  const since = now.getTime() - days * MS_PER_DAY;

  const merged = (Array.isArray(prs) ? prs : []).filter((pr) => {
    if (!pr?.merged_at) return false;
    const mergedAt = Date.parse(pr.merged_at);
    return Number.isFinite(mergedAt) && mergedAt >= since;
  });
  const checked = merged.filter((pr) => !isSkippedByWorkflow(pr));
  const missing = checked
    .filter((pr) => !noted.has(Number(pr.number)))
    .map((pr) => ({
      number: Number(pr.number),
      title: String(pr.title || ''),
      url: pr.html_url || '',
      mergedAt: pr.merged_at,
    }))
    .sort((a, b) => a.number - b.number);

  return { days, checkedCount: checked.length, missing };
}
