import { LECTURE_PRODUCT_ORDER } from '../constants/referenceDocs.js';

/**
 * 그룹 이름("VIOLA 3.0.6", "CONTRABASS")을 제품(대분류)과 버전(중분류)으로 나눈다.
 * 제품 이름이 목록(LECTURE_PRODUCT_ORDER)과 앞부분이 같으면 그 제품, 아니면 첫 단어를 제품으로 본다.
 */
export function splitGroupName(name, order = LECTURE_PRODUCT_ORDER) {
  const text = String(name || '').trim();
  const lower = text.toLowerCase();
  const known = [...order]
    .sort((a, b) => b.length - a.length)
    .find((p) => lower === p.toLowerCase() || lower.startsWith(`${p.toLowerCase()} `));
  if (known) return { product: known, version: text.slice(known.length).trim() };
  const [first, ...rest] = text.split(/\s+/);
  return { product: first || text, version: rest.join(' ') };
}

/** 최신 버전이 먼저 오도록 내림차순. 버전이 없는('') 묶음은 항상 맨 앞. */
function compareVersion(a, b) {
  if (!a || !b) return a === b ? 0 : a ? 1 : -1;
  return b.localeCompare(a, 'en', { numeric: true });
}

/**
 * 그룹 목록 → 제품 트리. 제품은 order 순(없는 제품은 뒤에 이름순),
 * 제품 안에서는 버전 없는 묶음이 먼저, 그다음 최신 버전이 위로 오는 내림차순.
 *
 * @param {{ name: string, docs: object[] }[]} groups
 * @returns {{ product: string, docCount: number, versions: { name: string, version: string, docs: object[] }[] }[]}
 */
export function buildProductTree(groups, order = LECTURE_PRODUCT_ORDER) {
  const byProduct = new Map();
  for (const g of groups) {
    const { product, version } = splitGroupName(g.name, order);
    if (!byProduct.has(product)) byProduct.set(product, []);
    byProduct.get(product).push({ name: g.name, version, docs: g.docs });
  }
  const rank = (p) => {
    const i = order.findIndex((o) => o.toLowerCase() === p.toLowerCase());
    return i === -1 ? order.length : i;
  };
  return [...byProduct.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, 'en'))
    .map(([product, versions]) => ({
      product,
      docCount: versions.reduce((n, v) => n + v.docs.length, 0),
      versions: versions.sort((a, b) => compareVersion(a.version, b.version)),
    }));
}

/** 제품 이름 → 색 (없으면 기본색). */
export function productColor(product, colors, fallback) {
  const key = Object.keys(colors).find((k) => k.toLowerCase() === String(product).toLowerCase());
  return key ? colors[key] : fallback;
}
