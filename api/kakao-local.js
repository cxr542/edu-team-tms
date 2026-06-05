/**
 * Kakao Local API proxy — 키는 서버 환경변수만 사용
 * GET /api/kakao-local?query=&page=1&lat=&lng=&radius=
 */
const ALLOWED_HOST_RE =
  /^(https?:\/\/)?([^/]*\.)?(edu-team-tms|okestro-edu-team-tms)\.vercel\.app|localhost(:\d+)?/i;

function canUse(req) {
  const referer = req.headers.referer || req.headers.origin || '';
  return ALLOWED_HOST_RE.test(referer);
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

/** @param {string} raw */
function resolveApiKey(raw) {
  const key = String(raw ?? process.env.KAKAO_REST_API_KEY ?? '').trim();
  if (!key || key === 'undefined') return '';
  return key;
}

/** @param {import('http').IncomingMessage} req @param {import('http').ServerResponse} res @param {{ apiKey?: string }} [options] */
export default async function handler(req, res, options = {}) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!canUse(req)) {
    return json(res, 403, { error: 'Forbidden' });
  }

  const apiKey = resolveApiKey(options.apiKey);
  if (!apiKey) {
    return json(res, 503, {
      available: false,
      message: 'KAKAO_REST_API_KEY가 설정되지 않았습니다.',
      places: [],
    });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const query = url.searchParams.get('query') || '파크원타워 맛집';
  const page = Math.min(Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1), 45);
  const lat = url.searchParams.get('lat') || '37.5261';
  const lng = url.searchParams.get('lng') || '126.9282';
  const radius = url.searchParams.get('radius') || '1000';
  const purpose = url.searchParams.get('purpose') || 'food';

  const kakaoUrl = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
  kakaoUrl.searchParams.set('query', query);
  kakaoUrl.searchParams.set('page', String(page));
  kakaoUrl.searchParams.set('size', purpose === 'geocode' ? '5' : '15');
  kakaoUrl.searchParams.set('x', lng);
  kakaoUrl.searchParams.set('y', lat);
  if (purpose === 'food') {
    kakaoUrl.searchParams.set('radius', radius);
    kakaoUrl.searchParams.set('sort', 'distance');
    kakaoUrl.searchParams.set('category_group_code', 'FD6');
  } else {
    kakaoUrl.searchParams.set('sort', 'accuracy');
  }

  try {
    const upstream = await fetch(kakaoUrl.toString(), {
      headers: { Authorization: `KakaoAK ${apiKey}` },
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      const msg = data.message || 'Kakao API error';
      const hint = /appKey/i.test(msg)
        ? '카카오 개발자 앱의 REST API 키를 사용하세요. (JavaScript 키·네이티브 키는 안 됩니다)'
        : undefined;
      return json(res, upstream.status, {
        error: msg,
        hint,
        places: [],
      });
    }

    const places = (data.documents || []).map((doc) => ({
      id: doc.id,
      name: doc.place_name,
      category: doc.category_name?.split('>').pop()?.trim() || '음식점',
      address: doc.road_address_name || doc.address_name || '',
      lat: doc.y ? parseFloat(doc.y) : null,
      lng: doc.x ? parseFloat(doc.x) : null,
      mapUrl: doc.place_url || `https://map.kakao.com/link/map/${doc.id}`,
      walkMinutes: doc.distance ? Math.max(1, Math.round(Number(doc.distance) / 80)) : 10,
    }));

    return json(res, 200, { available: true, places, meta: data.meta });
  } catch (e) {
    return json(res, 500, { error: e.message || 'Proxy error', places: [] });
  }
}
