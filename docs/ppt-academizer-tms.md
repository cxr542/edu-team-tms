# PPT Academizer × EDU-TMS

## SoT
- TMS UI: `module=academizer` → [`src/pages/AcademizerPage.jsx`](../src/pages/AcademizerPage.jsx)
- Conversion API: sibling repo [`cxr542/ppt-academizer`](https://github.com/cxr542/ppt-academizer) (FastAPI Docker)
- Deploy API: [`ppt-academizer/docs/DEPLOY-TMS-RENDER.md`](../../ppt-academizer/docs/DEPLOY-TMS-RENDER.md) (Render)
- Netlify UI/proxy: **deprecated** for TMS

## Status (2026-07-31)

| 항목 | 상태 |
|------|------|
| 로컬 API + fixture #1 스모크 | ✅ `01_k8s_dashboard_lab_lecture` preview·academize (13장) |
| `ppt-academizer` main | ✅ Render template fetch [PR #4](https://github.com/cxr542/ppt-academizer/pull/4) |
| TMS React 네이티브 UI | ✅ [PR #114](https://github.com/cxr542/edu-team-tms/pull/114) 머지 |
| Render 운영 API | ✅ `https://ppt-academizer-api.onrender.com` · `/health` `template_configured: true` |
| Vercel `PPT_ACADEMIZER_API_URL` | ✅ `https://ppt-academizer-api.onrender.com` |
| Prod E2E (fixture #1) | ✅ health proxy + preview/academize 13장 (2026-07-31) |

## Next

1. (선택) real_world fixture 2~5 — [`ppt-academizer/docs/evaluation/real_world_fixture_evaluation.md`](../../ppt-academizer/docs/evaluation/real_world_fixture_evaluation.md)
2. Free Render cold-start 안내 UX (선택)

상세 절차: sibling [`DEPLOY-TMS-RENDER.md`](../../ppt-academizer/docs/DEPLOY-TMS-RENDER.md)

## Runtime
1. Browser opens TMS `/admin?module=academizer`
2. `GET /api/academizer?action=health` (Vercel) → upstream `/health`
3. Upload preview/academize: browser **POST directly** to `PPT_ACADEMIZER_API_URL` (CORS; avoids Vercel body limits)

## Env (Vercel / `.env.local`)
```bash
PPT_ACADEMIZER_API_URL=https://ppt-academizer-api.onrender.com
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
