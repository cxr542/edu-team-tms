import { describe, expect, it } from 'vitest';
import { buildProductTree, splitGroupName } from '../src/utils/lectureGuideTree.js';

const g = (name, n = 1) => ({ name, docs: Array.from({ length: n }, (_, i) => ({ id: `${name}-${i}` })) });

describe('lectureGuideTree', () => {
  it('그룹 이름을 제품과 버전으로 나눈다', () => {
    expect(splitGroupName('VIOLA 3.0.6')).toEqual({ product: 'VIOLA', version: '3.0.6' });
    expect(splitGroupName('OKESTRO CMP 2.1')).toEqual({ product: 'OKESTRO CMP', version: '2.1' });
    expect(splitGroupName('CONTRABASS')).toEqual({ product: 'CONTRABASS', version: '' });
    expect(splitGroupName('NEWPROD 1.0')).toEqual({ product: 'NEWPROD', version: '1.0' });
  });

  it('제품은 지정 순서로, 버전은 최신이 위로 오게 정렬한다', () => {
    const tree = buildProductTree([
      g('VIOLA 3.0.6', 7),
      g('TROMBONE 1.0'),
      g('CONTRABASS 3.0.6', 2),
      g('VIOLA 3.0.5', 3),
      g('ZETA 1'),
      g('OKESTRO CMP 2.0'),
      g('CONTRABASS 3.0.5'),
    ]);
    expect(tree.map((t) => t.product)).toEqual(['CONTRABASS', 'VIOLA', 'OKESTRO CMP', 'TROMBONE', 'ZETA']);
    expect(tree[0].versions.map((v) => v.version)).toEqual(['3.0.6', '3.0.5']);
    expect(tree[1].versions.map((v) => v.version)).toEqual(['3.0.6', '3.0.5']);
    expect(tree[1].docCount).toBe(10);
  });

  it('버전 숫자는 자릿수로 비교한다 (3.0.10 이 3.0.9 보다 최신)', () => {
    const tree = buildProductTree([g('VIOLA 3.0.9'), g('VIOLA 3.0.10'), g('VIOLA 3.1.0')]);
    expect(tree[0].versions.map((v) => v.version)).toEqual(['3.1.0', '3.0.10', '3.0.9']);
  });

  it('버전이 없는 묶음은 제품 안에서 맨 앞에 온다', () => {
    const tree = buildProductTree([g('CONTRABASS 3.0.6'), g('CONTRABASS')]);
    expect(tree[0].versions.map((v) => v.name)).toEqual(['CONTRABASS', 'CONTRABASS 3.0.6']);
  });
});
