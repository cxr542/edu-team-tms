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
이 내용을 바탕으로 한 달간의 주요 업무 성과를 "카테고리별"로 분류하고, 각 업무가 "언제 시작해서 언제 끝났는지(시작 날짜 ~ 끝나는 날짜)"가 명확히 나타나도록 보고서 형식으로 요약해 주세요.

[업무일지 내용]
${journalText}

[요약 규칙]
1. 불필요한 일상 대화나 중요하지 않은 메모는 제외하세요.
2. 비슷한 카테고리의 업무는 하나로 묶어서 요약하세요.
3. 각 업무별로 진행 기간(예: 2026-08-01 ~ 2026-08-05)을 유추할 수 있다면 반드시 표기하세요.
4. 전문적이고 간결한 비즈니스 보고서 톤으로 작성해 주세요.
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

    let response = await fetchGemini('gemini-1.5-flash-latest');
    
    // Fallback if 1.5 flash is not found/supported for this API key
    if (response.status === 404) {
      console.log('gemini-1.5-flash-latest not found, falling back to gemini-pro...');
      response = await fetchGemini('gemini-pro');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', errorText);
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: `AI 서버 호출 중 오류가 발생했습니다 (HTTP ${response.status}): ${errorText}` }));
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
