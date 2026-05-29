/**
 * 카카오톡·SMS 법인카드 승인 알림 텍스트 파싱 (붙여넣기용)
 * 카드사·포맷마다 문구가 달라 100% 자동 매칭은 어렵습니다.
 */

function parseAmount(text) {
  const patterns = [
    /(?:금액|승인금액|이용금액|결제금액)\s*[:：]?\s*([\d,]+)\s*원?/i,
    /([\d,]+)\s*원\s*(?:승인|결제|사용)/i,
    /승인\s*([\d,]+)\s*원/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = Number(m[1].replace(/,/g, ''));
      if (n > 0) return n;
    }
  }
  const fallback = text.match(/([\d,]{3,})\s*원/);
  if (fallback) {
    const n = Number(fallback[1].replace(/,/g, ''));
    if (n > 0) return n;
  }
  return 0;
}

function parseMerchant(text) {
  const patterns = [
    /(?:가맹점|이용처|사용처|가맹점명|merchant)\s*[:：]?\s*([^\n\r]+)/i,
    /(?:사용처|구매처)\s*[:：]?\s*([^\n\r]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (/승인|결제/.test(lines[i]) && lines[i + 1] && !/원|일시|금액/.test(lines[i + 1])) {
      return lines[i + 1];
    }
  }
  return '';
}

function parseDateIso(text) {
  const now = new Date();
  const y = now.getFullYear();

  let m = text.match(
    /(?:일시|거래일시|승인일시|이용일시)\s*[:：]?\s*(\d{4})[./-](\d{1,2})[./-](\d{1,2})/
  );
  if (m) {
    return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  }

  m = text.match(
    /(?:일시|거래일시|승인일시)\s*[:：]?\s*(\d{1,2})[./-](\d{1,2})(?:\s+(\d{1,2}:\d{2}))?/
  );
  if (m) {
    return `${y}-${pad2(m[1])}-${pad2(m[2])}`;
  }

  m = text.match(/(\d{4})[년.\-/](\d{1,2})[월.\-/](\d{1,2})[일]?/);
  if (m) {
    return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  }

  m = text.match(/(\d{1,2})[월.\-/](\d{1,2})[일]?/);
  if (m) {
    return `${y}-${pad2(m[1])}-${pad2(m[2])}`;
  }

  const today = `${y}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  return today;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * @returns {{ ok: true, draft: object } | { ok: false, errors: string[] }}
 */
export function parseCardNotification(text) {
  const raw = String(text ?? '').trim();
  if (!raw) {
    return { ok: false, errors: ['알림 문구를 붙여넣어 주세요.'] };
  }

  const amount = parseAmount(raw);
  const merchant = parseMerchant(raw);
  const date = parseDateIso(raw);
  const errors = [];

  if (!amount) errors.push('금액을 찾지 못했습니다. (예: 금액 36,000원)');
  if (!merchant) errors.push('가맹점/이용처를 찾지 못했습니다. (예: 가맹점 스타벅스…)');

  if (errors.length) {
    return { ok: false, errors, partial: { date, amount, description: merchant } };
  }

  return {
    ok: true,
    draft: {
      date,
      amount,
      description: merchant,
      paymentMethod: '법인카드',
      category: '기타',
      attendees: '팀 모두',
      extraData: { 비고: '카카오 법인카드 알림', 원문: raw.slice(0, 500) },
    },
  };
}
