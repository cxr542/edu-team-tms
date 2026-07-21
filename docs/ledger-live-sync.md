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

게시 API는 허용된 origin의 관리자 URL에서 발급된 서버 관리자 세션 쿠키가 있어야 동작합니다.
선택: 서버 자동화가 브라우저 세션 없이 게시해야 하는 경우에만 `LEDGER_PUBLISH_SECRET`를 설정하고 `x-ledger-publish-key` 헤더로 전달합니다. 브라우저용 `VITE_*` 환경 변수에는 게시 키를 넣지 않습니다.

## 수동 배포 (Blob 미사용 시)

```bash
npm run publish:team -- ~/Downloads/ledger-snapshot.json
npm run deploy:vercel
```

## 작성은 보이는데 조회에 안 보일 때

1. **Edit·View는 저장소가 다릅니다.** 작성(`?mode=edit`)은 이 브라우저 `localStorage`, 조회(기본 URL)는 서버 스냅샷(Blob → 없으면 `ledger-snapshot.json`)입니다.
2. Edit에서 **「지금 조회에 반영」**을 눌러야 서버에 올라갑니다. 자동 동기화도 같은 API를 씁니다.
3. 운영에서 POST가 `blob-quota-exceeded`(Hobby Blob **1GB 초과**)이면 조회에 반영되지 않습니다.
   - Vercel → **Storage** → Blob → `ledger/live-` 등 오래된 파일 삭제 후 다시 반영
   - 또는 「지금 조회에 반영」으로 받은 JSON → `npm run publish:team` → 배포

배포 후 API는 `ledger/live-` 스냅샷을 최신 3개만 남기고 이전 파일을 자동 삭제합니다.

### Blob 정리 (자동 저장이 수만 번 쌓인 경우)

```bash
cd "apps/TMS(Team Management System)"
npx vercel env pull .env.vercel.prod --environment=production --yes
set -a && source .env.vercel.prod && set +a

# 스토어 전체 비우기 (rate limit 시 1~3분 뒤 재시도)
npm run blob:empty

# 또는 ledger/live- 타임스탬프 파일만 배치 삭제
npm run prune:ledger-blobs -- --wipe-all
```

반영 API는 **`ledger/live-latest.json` 한 파일만 덮어쓰기** 하도록 변경됨 (재발 방지).
