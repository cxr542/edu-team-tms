import { describe, expect, it } from 'vitest';

import { resolveCsrRequesterIdentity } from '../src/utils/csrRequesterIdentity.js';

describe('resolveCsrRequesterIdentity', () => {
  it('uses the selected member code and display name when available', () => {
    const identity = resolveCsrRequesterIdentity({
      scopedMember: 'C',
      defaultMemberCode: 'A',
      leaderMemberCode: 'A',
    });

    expect(identity).toEqual({
      requesterCode: 'C',
      requesterName: '신혜윤',
    });
  });

  it('falls back to the leader code when no scoped member is set', () => {
    const identity = resolveCsrRequesterIdentity({
      scopedMember: null,
      defaultMemberCode: 'A',
      leaderMemberCode: 'A',
    });

    expect(identity).toEqual({
      requesterCode: 'A',
      requesterName: '김윤형',
    });
  });
});
