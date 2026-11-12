#!/usr/bin/env node
/**
 * 운영 헬스체크 — GitHub Actions에서 매일 실행.
 *
 * 브라우저 아티팩트에서 하던 no-cors fetch와 달리, Node에서 직접 요청하므로
 * CORS 제약이 없다 — 실제 HTTP 상태 코드와 정확한 응답시간을 확인할 수 있다.
 *
 * 실패 시 exit code 1 (GitHub Actions가 실패로 표시 → 이슈 자동 생성 트리거).
 */

const BASE = 'https://edu-team-tms-ten.vercel.app';

const TARGETS = [
  // expected: 정상으로 간주할 HTTP 상태 코드. 이 목록에 없으면(다른 4xx 포함) 장애로 판정한다.
  { name: '홈페이지', url: `${BASE}/`, expected: [200] },
  // 장부는 Supabase 이관 후 GET 이 의도적으로 404 `snapshot not found` 를 반환(라우트 존재 확인용).
  { name: '장부 스냅샷 API', url: `${BASE}/api/ledger-snapshot`, expected: [404] },
  // 일지 API 는 인증 없이 호출하면 403 `forbidden` 이 정상.
  { name: '일지 스냅샷 API', url: `${BASE}/api/journal-snapshot`, expected: [403] },
];

const TIMEOUT_MS = 10_000;
const SLOW_MS = 3_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attemptOnce(target) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(target.url, { signal: controller.signal, cache: 'no-store' });
    const elapsed = Date.now() - start;
    clearTimeout(timer);
    // 대상별 기대 상태 코드와 일치할 때만 정상. 5xx·네트워크 실패·예상 밖 4xx(404/403 등)는 장애.
    const healthy = target.expected.includes(res.status);
    const error = healthy ? null : `예상 밖 응답 HTTP ${res.status} (기대: ${target.expected.join('/')}) · ${elapsed}ms`;
    return { ...target, status: res.status, elapsed, healthy, slow: elapsed > SLOW_MS, error };
  } catch (err) {
    clearTimeout(timer);
    const timedOut = err.name === 'AbortError';
    return {
      ...target,
      status: null,
      elapsed: Date.now() - start,
      healthy: false,
      slow: false,
      error: timedOut ? `타임아웃 (${TIMEOUT_MS}ms)` : err.message,
    };
  }
}

async function checkOne(target) {
  let result = await attemptOnce(target);
  let attempts = 1;
  while (!result.healthy && attempts < MAX_ATTEMPTS) {
    await sleep(RETRY_DELAY_MS);
    result = await attemptOnce(target);
    attempts += 1;
  }
  return { ...result, attempts };
}

async function main() {
  const results = await Promise.all(TARGETS.map(checkOne));

  let hasFailure = false;
  let hasWarning = false;

  console.log('## 운영 헬스체크 결과\n');
  for (const r of results) {
    const icon = !r.healthy ? '🔴' : r.slow ? '🟡' : '🟢';
    if (!r.healthy) hasFailure = true;
    if (r.healthy && r.slow) hasWarning = true;
    const detail = r.error ? r.error : `HTTP ${r.status} · ${r.elapsed}ms`;
    const retrySuffix = r.attempts > 1 ? ` (${r.attempts}번째 시도에서 ${r.healthy ? '성공' : '실패'})` : '';
    console.log(`${icon} ${r.name} — ${detail}${retrySuffix}`);
    console.log(`   ${r.url}`);
  }

  console.log('');
  if (hasFailure) {
    console.log('결과: 장애 감지됨 (기대와 다른 응답 또는 연결 실패)');
    process.exitCode = 1;
    return;
  }
  if (hasWarning) {
    console.log(`결과: 정상 — 다만 응답이 ${SLOW_MS}ms보다 느린 항목이 있습니다.`);
    process.exitCode = 0;
    return;
  }
  console.log('결과: 정상');
  process.exitCode = 0;
}

main().catch((err) => {
  console.error('헬스체크 스크립트 실행 중 오류:', err);
  process.exitCode = 1;
});
