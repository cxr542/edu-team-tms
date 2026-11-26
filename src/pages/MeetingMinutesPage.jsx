import React from 'react';
import LectureJournalPage from './LectureJournalPage.jsx';

/** Confluence 「회의록」 폴더 목록 (강의일지와 같은 브라우저 UI 재사용) */
export default function MeetingMinutesPage() {
  return (
    <LectureJournalPage
      root="meeting"
      title="회의록"
      tagline="Confluence 「회의록」 폴더 목록 · 본문은 Confluence에서 엽니다"
    />
  );
}
