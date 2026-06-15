# 교육팀 TMS (Team Management System) · v1.0

팀 빌딩비 장부·주간 업무일지(KPI M/M) 웹 앱.

> **워크스페이스:** 이 repo(`edu-team-tms`)만 clone·열어도 개발·배포 가능합니다.  
> 개인 포털(`cxr542-portal`)과 분리 운영 — [docs/workspace-guide.md](docs/workspace-guide.md)

## 환경

| 환경 | URL | 용도 |
|------|-----|------|
| **운영** | https://edu-team-tms-ten.vercel.app/ | 실제 장부·일지 (2026-06~ 새 Vercel·Blob) |
| **검증(Preview)** | PR별 Vercel preview URL | 팀 검증/리뷰 |
| **개발** | http://localhost:3000/ (`npm run dev`) | 기능 개발·테스트 |
| **팀 KPI 관리** | `?mode=edit&module=kpi` | 일지 연동 KPI 미리보기 |

- **localhost**와 **운영 URL**의 localStorage·IndexedDB는 **origin이 달라 완전히 분리**됩니다.
- Vercel 프리뷰 배포 URL도 **개발**으로 표시됩니다 (운영 alias만 운영).

### 운영 URL

| 용도 | URL |
|------|-----|
| 조회 | https://edu-team-tms-ten.vercel.app/ |
| 편집 | https://edu-team-tms-ten.vercel.app/?mode=edit |
| 일지 편집 | `?mode=edit&module=journal` |

## 로컬 실행 (repo 단독)

```bash
git clone https://github.com/cxr542/edu-team-tms.git
cd edu-team-tms
npm install
npm run dev
# → http://localhost:3000/ (포트 3000 고정 — 점유 중이면 기존 dev 프로세스 종료 후 재실행)
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

- [docs/sot-map.md](docs/sot-map.md) — 기준 문서와 복제/산출물 구분
- [docs/workspace-guide.md](docs/workspace-guide.md) — 맥(TMS) / 집(portal) 분리·폴더 정리
- [docs/deployment-process.md](docs/deployment-process.md)
- [docs/ledger-live-sync.md](docs/ledger-live-sync.md)
- [docs/mobile-home-screen.md](docs/mobile-home-screen.md)

## Documentation Map
- `AGENTS.md` — AI/Codex 작업 규칙. 작업자는 변경 전 이 문서를 먼저 확인합니다.
- `DESIGN.md` — EDU-TMS 제품/시스템 설계 문서.
- `docs/sot-map.md` — 문서 Source of Truth 지도. URL, 데이터, 배포, KPI, 참고문서 기준을 찾을 때 먼저 봅니다.
- `docs/obsidian-graph-poc.md` — Obsidian/docs graph PoC 안내.

## Current Sharing Model
- **Journal:** manual 「팀 공유 저장」 / 「팀 공유본 가져오기」 → `journal/live-latest.json`
- **Improve projects (KPI2):** `IMPROVE_PROJECT_BLOB_SHARE_ENABLED = true` — leader publish, members pull → `improve-projects/live-latest.json`
- **Ledger:** manual 「지금 조회에 반영」 → `ledger/live-latest.json`
- No automatic sync. Pilot: leader on `edu-team-tms-ten` first, then B/C migration.

## Source of Truth Note
Source reference documents live under `docs/reference-source/*`. Published/static copies under `public/docs/*` are not the source of truth. Build output under `.vercel/output/static/*` is also not source documentation.

## Docs Graph PoC
The docs graph PoC writes `docs/docs-graph.json` from Markdown sources. If only `generatedAt` changes after regeneration, do not treat it as a meaningful documentation change.

## 버전

- 현재: **1.0.0** (`package.json` → UI **v1.0**)
