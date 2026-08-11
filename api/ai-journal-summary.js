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
2. 출력 형식은 반드시 아래의 마크다운 형식을 엄격하게 따라야 합니다.
3. 대분류는 제공된 "카테고리" 명칭을 숫자(1., 2., 3. ...)와 함께 사용하고, 괄호 안에 해당 카테고리의 전반적인 성과를 요약하는 짧은 부제를 적어주세요.
4. 카테고리 내의 개별 주요 성과는 볼드체(**) 불릿(•)으로 작성하고, 그 아래에 세부 내용이나 진행 기간 등을 들여쓰기하여 작성해 주세요.
5. 관련 있는 업무들은 하나로 묶어 핵심만 간결한 비즈니스 톤으로 작성해 주세요.

[출력 예시]
1. 교육 (운영 및 이력 관리)
  * **교육 참석률 및 만족도 분석 기획**:
    * 고객사별 재방문 이력 추적 및 교육 만족도 평가 결과를 연동하기 위한 데이터 모델 및 분석 요구사항 검토
    * 진행 기간: 2026-07-01 ~ 2026-07-10
  * **교육 관련 데이터 수집 체계 구상**:
    * 엑셀 등에 산재된 교육 소스를 통합하기 위한 기획 정리

2. 교육 준비 (교재, presentation, 자동화)
  * **ppt-academizer 파이프라인 개발 및 연동**:
    * 주요 플랫폼 교육 자료 슬라이드 자동 변환 및 보강
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

    let response = await fetchGemini('gemini-flash-latest');
    
    // Fallback if flash-latest is not found/supported for this API key
    if (response.status === 404) {
      console.log('gemini-flash-latest not found, falling back to gemini-pro-latest...');
      response = await fetchGemini('gemini-pro-latest');
    }

    if (!response.ok) {
      const errorText = await response.text();
      let extraInfo = '';
      if (response.status === 404) {
        try {
          const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
          const modelsText = await modelsRes.text();
          extraInfo = `\n\n[Available Models for this Key]:\n${modelsText}`;
        } catch (e) {
          extraInfo = `\n\n[Failed to fetch available models]`;
        }
      }
      
      console.error('Gemini API Error:', errorText);
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: `AI 서버 호출 중 오류가 발생했습니다 (HTTP ${response.status}): ${errorText}${extraInfo}` }));
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
