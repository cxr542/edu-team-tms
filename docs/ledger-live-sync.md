# 팀 빌딩비 장부 — 관리자 작성 → 조회 실시간 반영

## 동작

| 화면 | URL | 데이터 |
|------|-----|--------|
| 관리자 작성 | `?mode=edit` | 브라우저 localStorage + **자동 서버 게시** |
| 팀 조회 | 기본 URL | `/api/ledger-snapshot` (Vercel Blob) · 8초마다 자동 새로고침 |

관리자에서 지출을 추가·수정·삭제하면 약 1초 후 서버에 올라가고, 조회 페이지는 최대 약 8~12초 안에 갱신됩니다.

## Vercel 설정 (최초 1회)

1. [Vercel](https://vercel.com) → 프로젝트 **okestro-edu-team-tms**
2. **Storage** → **Create Database** → **Blob** → Connect to project
3. **Redeploy** (환경 변수 `BLOB_READ_WRITE_TOKEN` 자동 주입)

선택: `LEDGER_PUBLISH_SECRET` + 동일 값을 `VITE_LEDGER_PUBLISH_KEY`에 넣으면 URL 검사 외 키 인증도 가능합니다. (미설정 시 `?mode=edit` Referer만으로 게시 허용)

## 수동 배포 (Blob 미사용 시)

```bash
npm run publish:team -- ~/Downloads/ledger-snapshot.json
npm run deploy:vercel
```
