# 교육팀 TMS (Team Management System)

팀 빌딩비 장부·주간 업무일지(KPI M/M) 웹 앱.

## URL

| 용도 | URL |
|------|-----|
| 조회 | https://okestro-edu-team-tms.vercel.app/ |
| 편집 | https://okestro-edu-team-tms.vercel.app/?mode=edit |
| 일지 편집 | `?mode=edit&module=journal` |
| 허브 데모 (Pages) | https://cxr542.github.io/cxr542-ai/projects/edu-team-tms/ |

## 로컬 실행

```bash
npm install
npm run dev
```

## 빌드·배포

```bash
npm run deploy:vercel          # Vercel 프로덕션
npm run build:team           # dist/ (스냅샷 포함)
```

허브(GitHub Pages) 반영은 monorepo에서:

```bash
cd cursorstudy/cxr542-ai && npm run deploy:edu-team-tms
```

## 문서

- [docs/mobile-home-screen.md](docs/mobile-home-screen.md)
- [docs/ledger-live-sync.md](docs/ledger-live-sync.md)
