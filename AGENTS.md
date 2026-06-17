# AGENTS.md — EDU-TMS AI/Codex Work Rules

## Purpose
This file defines the mandatory rules for AI/Codex agents working in the EDU-TMS repository.
`AGENTS.md` is the action rulebook.
`docs/sot-map.md` is the documentation Source of Truth map.
Before changing URLs, access rules, ledger/journal behavior, Blob behavior, KPI behavior, or deployment procedures, read `docs/sot-map.md` and the relevant Source of Truth document listed there.

## Project Context
EDU-TMS is an operational team management system for the OKESTRO education team.
Important production URLs:
- Production: `https://edu-team-tms-ten.vercel.app`
- Admin mode: `https://edu-team-tms-ten.vercel.app/admin`
- Journal example: `https://edu-team-tms-ten.vercel.app/yhkim?year=2026&month=6`

## Documentation Source of Truth
Read `docs/sot-map.md` first when working on documentation, URLs, access rules, deployment, ledger, journal, Blob, KPI, or improve-projects.
Important SoT documents include:
- `README.md`
- `DESIGN.md`
- `docs/sot-map.md`
- `docs/ledger-live-sync.md`
- `docs/deployment-process.md`
- `docs/reference-source/TMS-접속URL-북마크.md`
- `docs/reference-source/TMS-릴리즈노트.md`
- `docs/reference-source/KPI-일지-TMS-연계-가이드.md`
- `docs/reference-source/KPI-TMS-팀KPI메뉴.md`
- `docs/reference-source/KPI-TMS-운영모델-v2.md`
- `docs/reference-source/KPI-TMS-traceability-tms.md`
Do not treat these as Source of Truth:
- `public/docs/*`
- `.vercel/output/static/*`
- `public/tools/*`
- generated build output

## Hard Safety Rules
Never do the following without explicit approval:
- Modify operating data
- Modify ledger or journal JSON data
- Call Blob write/delete APIs
- Add or enable Blob POST/PUT/DELETE behavior
- Re-enable hidden Blob sharing UI
- Run Vercel manual deploy
- Re-run GitHub Actions
- Force push
- Run `npm install`
- Modify `.vercel/output/static/*`
- Modify `public/docs/*` as if it were source documentation
- Touch unrelated dirty files
- Use `git add .`
- Use `git restore .`
- Use `git checkout -- .`

## Blob and Team Share Rules
Production Blob store: **edu-team-tms-blob** on Vercel project **edu-team-tms-ten** (`https://edu-team-tms-ten.vercel.app`).

Required behavior:
- `IMPROVE_PROJECT_BLOB_SHARE_ENABLED = true` — leader publishes KPI2 improve-project list; members pull via 「팀 공유본 가져오기」
- `SHOW_BC_JOURNAL_TEAM_SHARE_UI = true` — B/C can 「팀 공유 저장」 and pull peer journals (own slice preserved on pull)
- No automatic cloud sync — manual save/pull only
- JSON improve-project import is fallback when `IMPROVE_PROJECT_BLOB_SHARE_ENABLED` is false
- Pilot rollout: stabilize on leader URL first; migrate B/C after team announcement (see TMS bookmark doc)

Do not mutate production Blob/localStorage during investigation unless explicitly fixing an issue.

## Data Safety Rules
Treat the following as operating data or sensitive state:
- ledger snapshots
- journal entries
- improve-projects shared data
- member-specific browser/localStorage data
- production API state
- Blob store contents
Do not mutate these during investigation.
For debugging, prefer read-only checks.

## Git Rules
Before any commit or push:
1. Run `git status -sb`
2. Check `git diff --name-only`
3. Confirm only intended files changed
4. Confirm unrelated dirty files are not staged
5. Use targeted `git add <file>` only
6. Never use `git add .`
7. Never force push
Before push:
1. Check `git log --oneline origin/main..HEAD`
2. Check `git diff --name-only origin/main..HEAD`
3. Confirm ahead commits and changed files match the requested task
4. If remote has moved, stop and report
5. Do not rebase/merge/reset unless explicitly requested

## Dirty Files and Generated Files
Known unrelated dirty files may exist in the main workspace. Do not touch them unless the task explicitly targets them.
Examples:
- `public/tools/ppt-academizer/index.html`
- `src/pages/AcademizerEmbedPage.jsx`
- `outputs/`
- `logs/`
- `backups-*`
Generated or copied documentation:
- `public/docs/*` is a copied/static publication target
- `.vercel/output/static/*` is build output
- Do not edit either as source

## Docs Graph Rules
The docs graph PoC consists of:
- `scripts/extract-docs-graph.mjs`
- `scripts/docs-graph-core.mjs`
- `docs/docs-graph.json`
- `docs/obsidian-graph-poc.md`
Rules:
- `docs/docs-graph.json` may be committed as a PoC artifact
- If only `generatedAt` changes, do not commit it
- If nodes, edges, summary, or document count changes, review whether the graph change is meaningful
- Before push, the worktree must be clean except explicitly accepted unrelated dirty files in the original workspace
- The graph extractor must not scan `public/docs`, `.vercel/output`, `outputs`, `logs`, `backups-*`, or operating data

## Testing and Verification
Preferred verification:
```bash
npm test
npm run build
git diff --check
```

If local dependencies are unavailable and commands fail with messages like:

- `vitest: command not found`
- `vite: command not found`
- `eslint: command not found`

then do not run `npm install` unless explicitly approved.
Report the failure as an environment limitation.

For docs graph changes:

```bash
node scripts/extract-docs-graph.mjs
node --check scripts/extract-docs-graph.mjs
node --check scripts/docs-graph-core.mjs
```

## Deployment Rules

- Do not run manual Vercel deploy
- Do not re-run GitHub Actions unless explicitly requested
- Git push may trigger automatic deployment
- After push, verify production URL only when requested or when deployment confirmation is part of the task

Production URL:

`https://edu-team-tms-ten.vercel.app`

Admin URL:

`https://edu-team-tms-ten.vercel.app/admin`

## Investigation vs Modification

For investigation tasks:

- Read files
- Run read-only commands
- Do not modify files
- Do not create commits
- Do not push

For modification tasks:

- Modify only explicitly allowed files
- Keep changes narrow
- Run available checks
- Commit only when requested
- Push only after explicit approval or explicit conditional push instruction

## If Unsure

Stop and report instead of guessing.

Especially stop before:

- Blob-related changes
- ledger/journal data changes
- access/URL changes
- deploy workflow changes
- public/docs changes
- force push/rebase/merge/reset
