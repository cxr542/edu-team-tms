import { memberCodeFromReferer, isAdminRouteReferer } from '../server/api-utils/requestScope.js';

export const maxDuration = 60; // Allow up to 60 seconds for Gemini API to respond

export default async function handler(req, res, options = {}) {
  const env = options.env || process.env;

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }

  // Auth check
  const memberCode = memberCodeFromReferer(req);
  const isAdmin = isAdminRouteReferer(req);
  if (!memberCode && !isAdmin) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
    return;
  }

  try {
    let bodyText = '';
    if (req.body && typeof req.body === 'object') {
      bodyText = JSON.stringify(req.body);
    } else {
      for await (const chunk of req) {
        bodyText += chunk;
      }
    }

    let body = {};
    if (bodyText) {
      body = typeof req.body === 'object' && Object.keys(req.body).length > 0 ? req.body : JSON.parse(bodyText);
    }

    const { journalText } = body;
    
    if (!journalText) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'No journalText provided' }));
      return;
    }

    const apiKey = (env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'GEMINI_API_KEY 환경 변수가 설정되지 않았습니다. 관리자에게 문의하세요.' }));
      return;
    }

    const prompt = `
다음은 한 구성원이 작성한 한 달 동안의 일일 업무일지 내용입니다.
이 내용을 바탕으로 한 달간의 주요 업무 성과를 "카테고리별"로 분류하여, 전문적이고 깔끔한 마크다운 보고서 형식으로 요약해 주세요.

[업무일지 내용]
${journalText}

[요약 및 출력 규칙 - 반드시 지켜주세요]
1. 불필요한 일상 대화나 중요하지 않은 메모는 제외하세요.
2. 마크다운 기호(*, **, # 등)는 절대 사용하지 마세요. 평문(Plain Text)으로만 작성해 주세요.
3. 대분류는 제공된 "카테고리" 명칭을 숫자(1., 2., 3. ...)와 함께 적고, 괄호 안에 해당 카테고리의 전반적인 성과를 요약하는 부제를 적어주세요.
4. 카테고리 내의 개별 주요 업무는 하이픈(-) 기호를 사용하여 제목을 적어주세요.
5. 세부 내용이나 진행 기간은 스페이스바 2칸 들여쓰기를 하여 깔끔하게 적어주세요.
6. 관련 있는 업무들은 하나로 묶어 핵심만 간결한 비즈니스 톤으로 작성해 주세요.

[출력 예시]
1. 교육 (운영 및 이력 관리)
- 교육 참석률 및 만족도 분석 기획
  [2026-07-01 ~ 2026-07-10] 고객사별 재방문 이력 추적 및 교육 만족도 평가 결과를 연동하기 위한 데이터 모델 및 분석 요구사항 검토
- 교육 관련 데이터 수집 체계 구상
  엑셀 등에 산재된 교육 소스를 통합하기 위한 기획 정리

2. 교육 준비 (교재, presentation, 자동화)
- ppt-academizer 파이프라인 개발 및 연동
  주요 플랫폼 교육 자료 슬라이드 자동 변환 및 보강
`;

    const fetchGemini = async (modelName) => {
      return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
    };

    // Gemini returns transient 429/5xx under high demand: retry with backoff,
    // then fall back to the next model. 404 (model unavailable for this key) skips to the next model.
    const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-pro-latest'];
    const RETRYABLE = new Set([429, 500, 502, 503, 504]);
    const MAX_ATTEMPTS_PER_MODEL = 2;
    const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

    let response = null;
    let lastStatus = 0;
    for (const modelName of MODELS) {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt += 1) {
        try {
          response = await fetchGemini(modelName);
        } catch (netErr) {
          console.error(`Gemini fetch failed (${modelName}):`, netErr);
          response = null;
          lastStatus = 0;
        }
        if (response?.ok) break;
        if (response) {
          lastStatus = response.status;
          console.error(`Gemini ${modelName} HTTP ${response.status} (attempt ${attempt}):`, await response.text());
          if (!RETRYABLE.has(response.status)) break;
        }
        if (attempt < MAX_ATTEMPTS_PER_MODEL) await sleep(1500 * attempt);
      }
      if (response?.ok) break;
    }

    if (!response?.ok) {
      const busy = lastStatus === 0 || RETRYABLE.has(lastStatus);
      res.statusCode = busy ? 503 : 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        ok: false,
        error: busy
          ? 'AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해 주세요.'
          : `AI 요약을 생성하지 못했습니다 (HTTP ${lastStatus}). 문제가 계속되면 관리자에게 문의하세요.`,
      }));
      return;
    }

    const data = await response.json();
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: true, summary }));
  } catch (error) {
    console.error('AI Summary Error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: error.message }));
  }
}
