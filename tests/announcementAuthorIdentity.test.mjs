import { describe, expect, it } from 'vitest';
import { resolveAnnouncementAuthorIdentity } from '../src/utils/announcementAuthorIdentity.js';

describe('resolveAnnouncementAuthorIdentity', () => {
  it('uses the selected member code and display name when available', () => {
    const identity = resolveAnnouncementAuthorIdentity({
      scopedMember: 'C',
      defaultMemberCode: 'A',
      leaderMemberCode: 'A',
    });

    expect(identity).toEqual({
      authorCode: 'C',
      authorName: '신혜윤',
    });
  });

  it('falls back to the leader code when no scoped member is set', () => {
    const identity = resolveAnnouncementAuthorIdentity({
      scopedMember: null,
      defaultMemberCode: 'A',
      leaderMemberCode: 'A',
    });

    expect(identity).toEqual({
      authorCode: 'A',
      authorName: '김윤형',
    });
  });
});
