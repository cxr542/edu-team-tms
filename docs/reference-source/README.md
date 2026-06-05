# TMS 참고문서 원본

TMS **참고문서** 메뉴에 표시되는 Markdown 원본입니다.

1. 이 폴더(`docs/reference-source/`)에서 `.md` 수정
2. `npm run sync:docs` 실행 → `public/docs/reference/` 반영
3. `npm run dev` 또는 `npm run build:team`으로 확인

monorepo(`okestro-app`)에 `kpi-app-new`가 있으면 sync 시 해당 파일로 **선택적 덮어쓰기**됩니다.  
TMS repo만 clone한 환경에서는 internal source만 사용합니다.
