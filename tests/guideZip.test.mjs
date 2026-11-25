import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { buildGuideZip } from '../src/utils/guideZip.js';

describe('buildGuideZip', () => {
  it('폴더별로 묶고 같은 제목은 번호를 붙이고 실패는 제외한다', async () => {
    const { blob, count, failed } = await buildGuideZip([
      { folder: 'VIOLA 3.0.6', title: 'HPA', load: async () => '<p>a</p>' },
      { folder: 'VIOLA 3.0.6', title: 'HPA', load: async () => '<p>b</p>' },
      { folder: '업로드', title: '깨짐', load: async () => '' },
      { folder: '업로드', title: '던짐', load: async () => { throw new Error('x'); } },
    ]);
    expect(count).toBe(2);
    expect(failed).toEqual(['깨짐', '던짐']);
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual(['VIOLA 3.0.6/HPA (2).html', 'VIOLA 3.0.6/HPA.html']);
    expect(strFromU8(files['VIOLA 3.0.6/HPA.html'])).toBe('<p>a</p>');
  });
});
