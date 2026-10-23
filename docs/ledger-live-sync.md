# 팀 빌딩비 장부 — 저장과 조회

장부(팀 빌딩비 지출)는 **Supabase 가 유일한 기준**이다. 관리자가 지출을 추가·수정·삭제하면 서버에 바로 저장되고, 팀원 조회 화면에도 즉시 보인다. 별도의 "게시" 단계는 없다.

> 2026-10-06에 Blob 수동 게시 방식에서 Supabase 로 이관했고, 2026-10-23에 운영 Blob 의 장부 파일(`ledger/live-latest.json`)과 정적 폴백(`public/ledger-snapshot.json`)을 삭제했다. 병행 구조의 옛 코드(Blob 게시·자동 게시 훅·옛 버튼/배너·플래그)도 제거했다. 이관 경과는 아래 "이력" 참고.

## 동작

| 화면 | URL | 데이터 |
|------|-----|--------|
| 관리자 편집 | `/admin` (장부) | Supabase 를 읽고, 서버 API 로 **행 단위 즉시 저장** |
| 팀원 조회 | `/yhkim` · `/wschoi` · `/hyshin` (장부 조회) | Supabase 를 anon 으로 읽기 전용 조회 |

- 테이블: `ledger_transactions`(거래) · `ledger_categories`(사용 유형) · `ledger_settings`(조회 메뉴 공개 설정). 스키마는 `supabase/ledger.sql`, `supabase/ledger-write-support.sql`.
- **읽기**: RLS 로 anon/authenticated 는 SELECT 만 가능하다.
- **쓰기**: 서버 API(`/api/ledger-snapshot?resource=…`, service role)에서만 일어난다. 요청은 허용된 origin + `/admin` referer + 서버 관리자 세션 쿠키(또는 서버 자동화용 `x-ledger-publish-key`)가 있어야 한다.
  - `POST/PATCH/DELETE ?resource=transactions` — 수정·삭제는 행의 `version`(낙관적 잠금)이 필요하고 불일치하면 409
  - `POST ?resource=transactions-bulk` — JSON 가져오기·엑셀·카드 알림 여러 건(병합, 또는 확인된 교체)
  - `PUT ?resource=categories`, `PUT ?resource=settings`
  - 잔액은 파생값(월 예산 − 누적 지출)이라 서버가 영향받은 달을 다시 계산한다.
- `GET /api/ledger-snapshot` 은 더 이상 스냅샷을 서빙하지 않고 `404 snapshot not found` 를 반환한다. 배포 스모크 체크와 헬스 체크가 라우트 존재 확인용으로 이 응답(200 또는 404)을 허용한다.
- 옛 `POST /api/ledger-snapshot`(스냅샷 통째 덮어쓰기)는 `410 blob-publish-removed` 를 반환한다.

## 관리자 화면에서 할 수 있는 것
- 지출 추가·수정·삭제, 전월 복사, 엑셀 불러오기·내보내기, 카드 알림 붙여넣기 등록, 사용 유형 관리, 조회 메뉴 공개 설정 — 모두 서버에 즉시 저장된다.
- **장부 JSON 백업 다운로드 / 가져오기**: 가져오기는 병합(같은 id 덮어쓰기, 새 항목 추가) 또는 교체(파일에 없는 항목 삭제)를 고른다. 교체는 거래 수가 줄거나 달이 사라지면 중단한다.
- **삭제 보호**: 한 번에 30건을 넘게 지울 수 없고 장부 전체 삭제는 차단된다. 「N월 전체 삭제」는 `N건 삭제` 문구를 직접 입력해야 하고, 「선택 삭제」도 5건 이상이면 입력 확인을 요구한다.
- 이 브라우저에 이관 전 localStorage 작성본이 남아 있으면 서버와 같을 때는 조용히 정리하고, 다를 때는 수정을 잠그고 "백업 JSON 다운로드 → 폐기"를 고르게 한다. 자동으로 올리거나 지우지 않는다.
- 관리자 로그인은 IP 당 15분에 5회 실패하면 잠긴다(`admin_login_attempts`).

## 백업과 복구
- **백업**: 관리자 화면의 「장부 JSON 백업 다운로드」, 또는 읽기 전용 스크립트:

```bash
SUPABASE_URL=… SUPABASE_ANON_KEY=… node scripts/export-ledger-from-supabase.mjs ./ledger-export.json
```

- **복구**: 백업 JSON 을 「장부 JSON 백업 가져오기」로 가져온다(병합 또는 교체). 대량 복구가 필요하면 `scripts/migrate-ledger-to-supabase.mjs`(기본 dry-run, `--execute` 에 service role 키 필요)를 쓴다.
- 더 이상 Blob 로 되돌리는 경로는 없다.

## 조회·저장이 안 보일 때
1. 팀원 화면에서 「조회 데이터 새로고침」을 눌러 본다(자동 새로고침은 꺼져 있다).
2. 관리자 저장 알림이 "서버에 저장했습니다"가 아니면 알림 문구를 따른다. `관리자 로그인이 필요합니다`(403)는 `/admin` 에서 다시 로그인, `다른 곳에서 먼저 수정되었습니다`(409)는 새로고침 후 다시 시도, `서버에 Supabase 설정이 없어…`(501)는 운영 환경변수 `SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY` 확인.
3. 배포 직후 1~2분은 화면이 비어 보일 수 있다. 강력 새로고침(Cmd+Shift+R).
4. 팀원 화면이 "아직 등록된 장부 데이터가 없습니다"면 `ledger_transactions` 가 비어 있는 것이다.

## 이력
- 이전에는 관리자 작성본이 브라우저 localStorage 에 있고 「지금 조회에 반영」(Blob publish)을 눌러야 팀원 조회에 보였다. 문서에는 "약 1초 후 자동 게시"라고 적혀 있었지만, 관리자 세션이 없거나 Blob 설정이 없으면 자동 게시가 오류를 알리지 않고 멈췄다. 그래서 반영을 놓치면 조회 화면에서 누락됐고(2026-10-02 지출 사례), 스냅샷 통째 덮어쓰기라 오래된 작성본이 최신 입력을 지울 위험도 있었다.
- 2026-10-06 Supabase 이관(PR #146·#147·#150·#151), 삭제 보호(#152), anon 1단계 보강(#153), 2026-10-23 Blob 장부·정적 폴백 삭제(#214), 이후 병행 구조 옛 코드 제거.
