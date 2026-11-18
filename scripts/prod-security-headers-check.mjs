#!/usr/bin/env node
/**
 * 운영 보안 헤더 점검 — GitHub Actions(daily-health-check)에서 매일 실행.
 *
 * vercel.json이 경로별로 정한 보안 헤더(기본 4개 + CSP 또는 CSP Report-Only)를 계산하고,
 * 운영에 실제로 요청해 응답 헤더 값이 그대로 같은지 비교한다. 읽기(GET) 요청만 보낸다.
 *
 * 실패 시 exit code 1 → 워크플로의 이슈 자동 생성 단계가 이어서 동작한다.
 * vercel.json을 바꾼 PR이 머지된 직후 배포가 끝나기 전이면 일시적으로 실패할 수 있다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://edu-team-tms-ten.vercel.app';

// 각 CSP 규칙을 대표하는 경로. 강의 가이드는 실제 파일 경로를 쓴다.
export const PATHS = [
  '/',
  '/yhkim',
  '/admin',
  '/sw.js',
  '/docs/reference/lecture-guides/viola-3.0.6/VIOLA-3.0.6-HPA-시연-가이드-v2.html',
  '/tools/cloud-chatbot/home.html',
  '/preview/cxr542-launcher-mockup.html',
];

const CSP_KEYS = ['content-security-policy', 'content-security-policy-report-only'];
const TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2_000;

/**
 * vercel.json headers 규칙 중 pathname에 걸리는 헤더를 소문자 키로 모은다.
 * Vercel은 path-to-regexp로 매칭하지만, 이 저장소의 source는 정규식 그룹이라 고정 정규식으로 같다.
 */
export function expectedHeadersFor(vercelConfig, pathname) {
  const expected = {};
  for (const rule of vercelConfig.headers || []) {
    if (new RegExp(`^${rule.source}$`).test(pathname)) {
      for (const { key, value } of rule.headers) expected[key.toLowerCase()] = value;
    }
  }
  return expected;
}

/**
 * 기대 헤더와 실제 응답 헤더를 비교해 문제 목록을 돌려준다(빈 배열이면 정상).
 * actual은 get(name)을 가진 객체(Headers 등)다.
 */
export function compareHeaders(expected, actual) {
  const problems = [];
  for (const [key, value] of Object.entries(expected)) {
    const got = actual.get(key);
    if (got == null) problems.push(`${key} 없음`);
    else if (got !== value) problems.push(`${key} 값이 다름`);
  }
  for (const key of CSP_KEYS) {
    if (!(key in expected) && actual.get(key) != null) problems.push(`${key}가 예상과 달리 붙음`);
  }
  return problems;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkPath(vercelConfig, pathname) {
  const expected = expectedHeadersFor(vercelConfig, pathname);
  const url = `${BASE}${encodeURI(pathname)}`;
  let last = { pathname, url, problems: ['요청하지 못함'], status: null };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal, cache: 'no-store', redirect: 'manual' });
      clearTimeout(timer);
      // 헤더는 응답이 와야만 비교할 수 있다. 응답을 받았으면 결과를 바로 쓴다(값 차이는 재시도로 바뀌지 않는다).
      const problems = res.status >= 500 ? [`HTTP ${res.status}`] : compareHeaders(expected, res.headers);
      last = { pathname, url, problems, status: res.status, attempts: attempt };
      if (res.status < 500) return last;
    } catch (err) {
      clearTimeout(timer);
      last = { pathname, url, problems: [err.name === 'AbortError' ? `타임아웃 (${TIMEOUT_MS}ms)` : err.message], status: null, attempts: attempt };
    }
    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
  }
  return last;
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const vercelConfig = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const results = await Promise.all(PATHS.map((p) => checkPath(vercelConfig, p)));

  console.log('## 운영 보안 헤더 점검 결과\n');
  for (const r of results) {
    const ok = r.problems.length === 0;
    const count = Object.keys(expectedHeadersFor(vercelConfig, r.pathname)).length;
    const detail = ok ? `헤더 ${count}개 일치 · HTTP ${r.status}` : r.problems.join(', ');
    console.log(`${ok ? '🟢' : '🔴'} ${r.pathname} — ${detail}`);
  }
  console.log('');
  if (results.some((r) => r.problems.length > 0)) {
    console.log('결과: 운영 응답 헤더가 vercel.json과 다릅니다. 배포 직후라면 배포 완료 후 다시 확인하세요.');
    process.exitCode = 1;
    return;
  }
  console.log('결과: 정상 — 운영 응답 헤더가 vercel.json과 일치합니다.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('보안 헤더 점검 스크립트 실행 중 오류:', err);
    process.exitCode = 1;
  });
}
