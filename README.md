# 교육팀 TMS (Team Management System) · v1.0

팀 빌딩비 장부·주간 업무일지(KPI M/M) 웹 앱.

> **워크스페이스:** 이 repo(`edu-team-tms`)만 clone·열어도 개발·배포 가능합니다.  
> 개인 포털(`cxr542-portal`)과 분리 운영 — [docs/workspace-guide.md](docs/workspace-guide.md)

## 환경

| 환경 | URL | 용도 |
|------|-----|------|
| **운영** | https://okestro-edu-team-tms.vercel.app/ | 실제 장부·일지 |
| **검증(Preview)** | PR별 Vercel preview URL | 팀 검증/리뷰 |
| **개발** | http://localhost:3000/ (`npm run dev`) | 기능 개발·테스트 |
| **팀 KPI 관리** | `?mode=edit&module=kpi` | 일지 연동 KPI 미리보기 |

- **localhost**와 **운영 URL**의 localStorage·IndexedDB는 **origin이 달라 완전히 분리**됩니다.
- Vercel 프리뷰 배포 URL도 **개발**으로 표시됩니다 (운영 alias만 운영).

### 운영 URL

| 용도 | URL |
|------|-----|
| 조회 | https://okestro-edu-team-tms.vercel.app/ |
| 편집 | https://okestro-edu-team-tms.vercel.app/?mode=edit |
| 일지 편집 | `?mode=edit&module=journal` |

## 로컬 실행 (repo 단독)

```bash
git clone https://github.com/cxr542/edu-team-tms.git
cd edu-team-tms
npm install
npm run dev
# → http://localhost:3000/
```

프로덕션 빌드 미리보기:

```bash
npm run build:team
npm run preview
```

## 참고문서·PPT 아카데미화 (TMS repo 내부)

| 항목 | 수정 위치 | 반영 |
|------|-----------|------|
| KPI 참고문서 | `docs/reference-source/*.md` | `npm run sync:docs` |
| PPT 아카데미화 UI | `public/tools/ppt-academizer/` | `npm run sync:academizer` (vendored UI 유지) |

- PPT **변환 API** 운영: Netlify (`ppt-academizer.netlify.app`) — TMS embed가 호출
- 로컬에서 변환 API 디버깅: sibling `ppt-academizer` repo + `npm run sync:academizer:dev` (선택)

## 빌드·배포

```bash
npm test
npm run build          # vite 빌드만
npm run build:team     # 문서 sync + 스냅샷 + 빌드
```

GitHub Actions (`edu-team-tms` repo):

- PR: `CI PR Checks` + `Deploy Preview`
- main: `Deploy Production` (GitHub Environment `production` 승인)

## 문서

- [docs/workspace-guide.md](docs/workspace-guide.md) — 맥(TMS) / 집(portal) 분리·폴더 정리
- [docs/deployment-process.md](docs/deployment-process.md)
- [docs/ledger-live-sync.md](docs/ledger-live-sync.md)
- [docs/mobile-home-screen.md](docs/mobile-home-screen.md)

## 버전

- 현재: **1.0.0** (`package.json` → UI **v1.0**)
