# PPT Academizer × EDU-TMS

## SoT
- TMS UI: `module=academizer` → [`src/pages/AcademizerPage.jsx`](../src/pages/AcademizerPage.jsx)
- Conversion API: sibling repo [`cxr542/ppt-academizer`](https://github.com/cxr542/ppt-academizer) (FastAPI Docker)
- Deploy API: [`ppt-academizer/docs/DEPLOY-TMS-RENDER.md`](../../ppt-academizer/docs/DEPLOY-TMS-RENDER.md) (Render)
- Netlify UI/proxy: **deprecated** for TMS

## Status (2026-07-23)

| 항목 | 상태 |
|------|------|
| 로컬 API + fixture #1 스모크 | ✅ `01_k8s_dashboard_lab_lecture` preview·academize (13장) |
| `ppt-academizer` main | ✅ [PR #2](https://github.com/cxr542/ppt-academizer/pull/2) 머지 (`a21486d`) — TMS CORS·Render 문서 |
| TMS React 네이티브 UI | ⏳ `feature/academizer-native-ui` PR (iframe → `AcademizerPage`) |
| Render 운영 API | ❌ 미배포 (`TEMPLATE_PPTX` 포함) |
| Vercel `PPT_ACADEMIZER_API_URL` | ❌ prod 미설정 (로컬만 `.env.local` → `http://127.0.0.1:8766`) |

## Next (나중에 / 내일)

순서 고정:

1. **Render**에 `cxr542/ppt-academizer` Docker 기동 + `TEMPLATE_PPTX` (컨테이너 경로, 템플릿은 git 금지)  
   → `/health` = `ok` + `template_configured: true`
2. **TMS** Academizer UI만 골라 PR·머지 (Sheets/교육관리 WIP과 섞지 말 것)
3. **Vercel** env `PPT_ACADEMIZER_API_URL=https://<render>` (+ 선택 `VITE_PPT_ACADEMIZER_API_URL`)
4. Prod 스모크: `/admin?module=academizer`에 fixture #1 업로드 E2E
5. (이후) real_world fixture 2~5 품질 — [`ppt-academizer/docs/evaluation/real_world_fixture_evaluation.md`](../../ppt-academizer/docs/evaluation/real_world_fixture_evaluation.md)

상세 절차: sibling [`DEPLOY-TMS-RENDER.md`](../../ppt-academizer/docs/DEPLOY-TMS-RENDER.md)

## Runtime
1. Browser opens TMS `/admin?module=academizer`
2. `GET /api/academizer?action=health` (Vercel) → upstream `/health`
3. Upload preview/academize: browser **POST directly** to `PPT_ACADEMIZER_API_URL` (CORS; avoids Vercel body limits)

## Env (Vercel / `.env.local`)
```bash
PPT_ACADEMIZER_API_URL=https://<render-service>.onrender.com
# local (verified 2026-07-23):
# PPT_ACADEMIZER_API_URL=http://127.0.0.1:8766
# VITE_PPT_ACADEMIZER_API_URL=http://127.0.0.1:8766
```

## Local smoke (이미 통과한 경로)
```bash
# API
cd ppt-academizer
export TEMPLATE_PPTX="$(mdfind 'kMDItemFSName == \"1.아카데미 강의안 템플릿.pptx\"' | head -1)"
PPT_ACADEMIZER_SKIP_PP_REPAIR=1 PORT=8766 ./scripts/run_server.sh

# fixture #1 (gitignored) — 원본 예: ~/Documents/k8s_dashboard_lab_lecture.pptx
# → tests/fixtures/real_world/01_k8s_dashboard_lab_lecture.pptx

# TMS
# .env.local: PPT_ACADEMIZER_API_URL=http://127.0.0.1:8766
npm run dev   # /admin?module=academizer
```

결과 샘플(로컬): `ppt-academizer/outputs/smoke/01_k8s_academized.pptx`

## Access
Admin shell only (관리·공통) for now — same as previous embed.
