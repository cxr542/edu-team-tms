import { JOURNAL_CATS } from '../constants/journalCategories';

/**
 * 월간 AI 요약용 일지 텍스트. days 는 { 'YYYY-MM-DD': { tasks: [{ cat, title, note }] } } 형태.
 * categories 는 구성원 범례(resolveMemberCategories().cats)를 넘기면 일지 화면과 같은 이름을 쓴다.
 * 반환값이 빈 문자열이면 요약할 내용이 없는 것.
 */
export function buildMonthJournalText(days, year, monthIndex, categories = JOURNAL_CATS) {
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`;
  return Object.keys(days || {})
    .filter((dayKey) => dayKey.startsWith(prefix))
    .sort()
    .map((dayKey) => {
      const lines = (days[dayKey]?.tasks || [])
        .filter((task) => String(task?.title || '').trim())
        .map((task) => {
          const cat = categories?.[task.cat]?.label || JOURNAL_CATS[task.cat]?.label || JOURNAL_CATS.other.label;
          const note = String(task.note || '').trim();
          return `- 카테고리: ${cat}, 내용: ${String(task.title).trim()}${note ? ` (${note})` : ''}`;
        });
      return lines.length ? `[${dayKey}]\n${lines.join('\n')}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}
