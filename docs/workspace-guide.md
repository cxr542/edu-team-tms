# 워크스페이스·폴더 정리 가이드

TMS(회사·업무)와 cxr542-portal(집·개인)을 **두 repo**로 나눠 운영하는 기준입니다.

## 1. 일상 작업 — repo 두 개만

| 어디서 | 프로젝트 | clone | Vercel |
|--------|----------|-------|--------|
| **회사 맥북** | **TMS** | `github.com/cxr542/edu-team-tms` | `okestro-edu-team-tms` |
| **집 윈도우** | **cxr542-portal** | `github.com/cxr542/cxr542-portal` | `cxr542-portal` |

Cursor / VS Code는 **각 repo 루트 폴더 하나만** 열면 됩니다.  
`okestro-app` monorepo 전체를 열 필요 없습니다.

### TMS (이 repo)

```bash
git clone https://github.com/cxr542/edu-team-tms.git
cd edu-team-tms
npm install && npm run dev
```

- KPI 참고문서: `docs/reference-source/` 수정 → `npm run sync:docs`
- PPT 아카데미화 UI: `public/tools/ppt-academizer/` (vendored)
- 환경 변수: `.env.local` (Kakao 등)

### cxr542-portal (별도 repo)

```bash
git clone https://github.com/cxr542/cxr542-portal.git
cd cxr542-portal
npm install && npm run dev
```

- vision-font, today-shoes, 마라톤, 개인 아이디어 뱅크
- TMS **「이것도」**와 데이터·URL **무관**

---

## 2. okestro-app monorepo `apps/` 폴더 감사 (2026-06)

monorepo에 예전 실험 폴더가 많습니다. **삭제 여부** 기준:

### 삭제해도 무방 (로컬 정리)

| 폴더 | 이유 | 비고 |
|------|------|------|
| `TMS(...)/Users/` | `vite create` 실수로 생긴 **cxr542-portal 복사본** | git 미추적, **삭제 완료** |
| `kpi-app-legacy/` | 2026-05 보관 아카이브. `kpi-app-new`로 대체됨 | 구 FastAPI MVP·옛 엑셀만 있음. **히스토리 불필요하면 삭제 OK** |

### 지금은 안 써도 되지만, 삭제 전 확인 권장

| 폴더 | 역할 | 삭제 시 영향 |
|------|------|--------------|
| `competency-manage/` | ~~역량평가 설계~~ | **TMS KPI3 루브릭으로 이전 완료** — 폴더 삭제됨 |
| `mileage-api/` | Google Sheets 마일리지 API 실험 | TMS·portal과 무관. **미사용이면 삭제 OK** |
| `today-shoes/` (monorepo) | Expo 앱 로컬 사본 | portal은 GitHub Pages URL 사용. **repo `cxr542/today-shoes`가 원본** |

### 유지 권장 (가끔/별도 용도)

| 폴더 | 역할 | TMS/portal과 관계 |
|------|------|-------------------|
| `kpi-app-new/` | KPI 시뮬레이터(Python)·엑셀 스크립트·정의서 원본 | TMS는 `docs/reference-source/`로 **자체 보유**. 시뮬레이터 쓸 때만 필요 |
| `ppt-academizer/` | PPT 변환 **엔진** (Python, Netlify 배포) | TMS는 embed UI + Netlify API. **엔진 수정 시** 필요 |
| `cxr542/` | GitHub Pages (`cxr542.github.io`) | 허브·today-shoes Pages. portal 외부 링크 |
| `cloud-chatbot/` | Render 배포 중인 챗봇 | `github.com/cxr542/cloud-chatbot` — **별도 서비스** |
| `cxr542-portal/` | 개인 포털 정본 | monorepo 사본. **작업은 GitHub repo clone 권장** |

### 운영 중 — 삭제하지 말 것

| 폴더 | GitHub | 배포 |
|------|--------|------|
| `TMS(Team Management System)/` | `edu-team-tms` | Vercel TMS |
| `cxr542-portal/` | `cxr542-portal` | Vercel portal |

---

## 3. 헷갈릴 때 체크리스트

1. **교육팀·장부·KPI·오늘 뭐 먹지** → TMS (`edu-team-tms`)
2. **개인 미니앱·마라톤·vision-font** → cxr542-portal
3. **PPT 변환 로직(서버)** → `ppt-academizer` repo
4. **KPI 웹 시뮬레이터 데모** → `kpi-app-new/web`
5. monorepo `apps/` 아래 **중복·`Users/` 경로** → 삭제 대상

---

## 4. CI/CD Secrets (repo별)

각 GitHub repo Settings → Secrets:

- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (TMS용 / portal용 **값이 다름**)
- TMS 추가: Vercel에 `KAKAO_REST_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `LEDGER_PUBLISH_SECRET`

상세: [deployment-process.md](deployment-process.md)
