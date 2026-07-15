import { describe, expect, it } from 'vitest';
import {
  collectJournalTaskTitles,
  filterJournalTaskTitleSuggestions,
} from '../src/utils/journalTaskTitleSuggestions.js';

describe('journalTaskTitleSuggestions', () => {
  it('collects unique trimmed titles sorted in Korean locale', () => {
    const titles = collectJournalTaskTitles({
      '2026-07-01': {
        tasks: [{ title: '강의 모듈 업데이트' }, { title: ' 교육 준비 ' }, { title: '' }],
      },
      '2026-07-02': {
        tasks: [{ title: '강의 모듈 업데이트' }, { title: '회의' }],
      },
    });
    expect(titles).toEqual(['강의 모듈 업데이트', '교육 준비', '회의']);
  });

  it('prefers prefix matches and hides exact match by default', () => {
    const titles = ['강의 모듈 업데이트', '강의 교안 작성', '교육 준비', '모듈 점검'];
    expect(filterJournalTaskTitleSuggestions(titles, '강의')).toEqual([
      '강의 모듈 업데이트',
      '강의 교안 작성',
    ]);
    expect(filterJournalTaskTitleSuggestions(titles, '강의 모듈 업데이트')).toEqual([]);
    expect(filterJournalTaskTitleSuggestions(titles, '모듈')).toEqual([
      '모듈 점검',
      '강의 모듈 업데이트',
    ]);
  });

  it('returns leading titles when query is empty', () => {
    const titles = ['a', 'b', 'c'];
    expect(filterJournalTaskTitleSuggestions(titles, '', { limit: 2 })).toEqual(['a', 'b']);
  });
});
