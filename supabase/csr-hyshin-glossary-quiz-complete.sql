-- Scoped to exactly ONE CSR record: 신혜윤's "용어사전을 활용한 게임 개발 요청"
-- (id confirmed via SELECT: c75531fc-1db2-416c-8ab6-6bf6caff315d)
-- Marks it done now that the glossary quiz (?module=glossary-quiz) is live.

update public.csr_requests
set
  status = 'done',
  admin_comment = '완료되었습니다. 용어사전(Supabase)에 등록된 실제 용어 데이터를 그대로 사용해 O/X·단답형 퀴즈를 만들었습니다. 새 용어가 추가될수록 문제 풀도 자동으로 늘어나며, 항목 수보다 많은 문제는 출제되지 않습니다. 용어사전 페이지 상단의 "퀴즈로 풀어보기" 버튼(또는 ?module=glossary-quiz)에서 바로 이용하실 수 있어요.',
  completed_at = now(),
  updated_at = now()
where id = 'c75531fc-1db2-416c-8ab6-6bf6caff315d';
