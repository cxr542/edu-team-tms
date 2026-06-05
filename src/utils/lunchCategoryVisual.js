/**
 * 카테고리·태그 기반 카드 히어로 (이미지 없이 맛집 앱 스타일 비주얼)
 * @param {string} [category]
 * @param {string[]} [tags]
 */
export function getCategoryVisual(category = '', tags = []) {
  const c = String(category).toLowerCase();
  const tagSet = new Set(tags || []);

  if (c.includes('일식') || c.includes('초밥') || c.includes('우동')) {
    return {
      emoji: '🍣',
      gradient: 'linear-gradient(145deg, #e8f4ff 0%, #b8d9ff 55%, #7eb8ff 100%)',
      accent: '#1d6fd8',
    };
  }
  if (c.includes('중식') || c.includes('짜장') || c.includes('짬뽕')) {
    return {
      emoji: '🥟',
      gradient: 'linear-gradient(145deg, #fff0f0 0%, #ffc9c9 55%, #ff9b9b 100%)',
      accent: '#c92a2a',
    };
  }
  if (
    c.includes('양식') ||
    c.includes('파스타') ||
    c.includes('스테이크') ||
    tagSet.has('cuisineWestern') ||
    tagSet.has('western')
  ) {
    return {
      emoji: '🥗',
      gradient: 'linear-gradient(145deg, #f0fff4 0%, #c3fae8 55%, #8ce99e 100%)',
      accent: '#2b8a3e',
    };
  }
  if (c.includes('분식') || c.includes('김밥') || c.includes('떡볶')) {
    return {
      emoji: '🍢',
      gradient: 'linear-gradient(145deg, #fff9db 0%, #ffe066 55%, #fcc419 100%)',
      accent: '#e67700',
    };
  }
  if (
    c.includes('국밥') ||
    c.includes('찌개') ||
    c.includes('국물') ||
    tagSet.has('noodle')
  ) {
    return {
      emoji: '🍜',
      gradient: 'linear-gradient(145deg, #fff4e6 0%, #ffd8a8 55%, #ffa94d 100%)',
      accent: '#d9480f',
    };
  }
  if (c.includes('한식') || c.includes('백반') || c.includes('고기')) {
    return {
      emoji: '🍚',
      gradient: 'linear-gradient(145deg, #fff5f5 0%, #ffc9c9 50%, #ffa8a8 100%)',
      accent: '#c2255c',
    };
  }
  if (c.includes('카페') || c.includes('디저트') || c.includes('베이커')) {
    return {
      emoji: '☕',
      gradient: 'linear-gradient(145deg, #f8f0fc 0%, #e5dbff 55%, #d0bfff 100%)',
      accent: '#7048e8',
    };
  }

  return {
    emoji: '🍽️',
    gradient: 'linear-gradient(145deg, #f8f4f1 0%, #e7f5ff 50%, #d0ebff 100%)',
    accent: '#006dff',
  };
}
