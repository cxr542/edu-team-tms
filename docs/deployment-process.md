# TMS 배포 프로세스 (GitHub Actions + Vercel)

> repo 단독 clone 기준. 워크스페이스 분리: [workspace-guide.md](workspace-guide.md)

## 1. 환경 구조
- 개발: `localhost` (`npm run dev`)
- 검증: PR Preview (GitHub Actions `Deploy Preview`)
- 운영: `https://edu-team-tms.vercel.app/` (GitHub Environment 승인 후 배포)

## 2. 사전 준비

### GitHub Secrets
Repository Settings -> Secrets and variables -> Actions 에 아래 값을 추가합니다.

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### GitHub Environment
Repository Settings -> Environments 에 `production` 환경 생성:

- Required reviewers 설정 (운영 승인자)
- 운영 배포는 승인 후에만 실행

### Vercel Environment Variables 점검
프로젝트 `okestro-edu-team-tms` 의 Environment Variables에 다음 값이 등록되어야 합니다.

- `KAKAO_REST_API_KEY`
- `BLOB_READ_WRITE_TOKEN`
- `LEDGER_PUBLISH_SECRET`

필요 시 `Production`/`Preview` 범위를 나눠 설정합니다.

## 3. 파이프라인 동작

### PR 생성/수정 시
1. `CI PR Checks` 실행 (test/build)
2. `Deploy Preview` 실행 (Vercel preview URL 생성)
3. PR 코멘트와 Actions Summary에서 preview URL 확인

### main 머지 후
1. `Deploy Production` 실행 시작
2. `production` 환경 승인 대기
3. 승인 완료 후 운영 배포
4. 스모크 체크(`/`, `/api/ledger-snapshot`) 실행

## 4. 장애 대응
- 배포 실패 시 Actions 로그 확인
- Vercel 최근 정상 배포로 재배포(rollback) 수행
- Secrets/Environment Variables 누락 여부 재확인

## 5. 운영 원칙
- 로컬에서 직접 `vercel --prod` 실행은 비상 상황으로 제한
- 일반 릴리즈는 GitHub Actions 승인 배포 경로만 사용
