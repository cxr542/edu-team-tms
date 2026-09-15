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
  { name: '홈페이지', url: `${BASE}/` },
  { name: '장부 스냅샷 API', url: `${BASE}/api/ledger-snapshot` },
  { name: '일지 스냅샷 API', url: `${BASE}/api/journal-snapshot` },
];

const TIMEOUT_MS = 10_000;
const SLOW_MS = 3_000;

async function checkOne(target) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(target.url, { signal: controller.signal, cache: 'no-store' });
    const elapsed = Date.now() - start;
    clearTimeout(timer);
    // 4xx는 "서버는 응답함"으로 간주(예: 인증 필요 페이지), 5xx/네트워크 실패만 장애로 취급
    const healthy = res.status < 500;
    return { ...target, status: res.status, elapsed, healthy, slow: elapsed > SLOW_MS, error: null };
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
    console.log(`${icon} ${r.name} — ${detail}`);
    console.log(`   ${r.url}`);
  }

  console.log('');
  if (hasFailure) {
    console.log('결과: 장애 감지됨 (5xx 응답 또는 연결 실패)');
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
