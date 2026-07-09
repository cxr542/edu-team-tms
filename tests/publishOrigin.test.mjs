import { describe, expect, it } from 'vitest';
import { isAllowedPublishOrigin } from '../server/api-utils/publishOrigin.js';

describe('isAllowedPublishOrigin', () => {
  it('allows localhost and known TMS deployment origins', () => {
    expect(isAllowedPublishOrigin('http://localhost:3000/')).toBe(true);
    expect(isAllowedPublishOrigin('https://edu-team-tms-ten.vercel.app/admin')).toBe(true);
    expect(isAllowedPublishOrigin('https://okestro-edu-team-tms.vercel.app/?mode=edit')).toBe(true);
    expect(isAllowedPublishOrigin('https://edu-team-tms.vercel.app/?mode=edit')).toBe(true);
  });

  it('allows edu-team-tms Vercel Preview deployment origins', () => {
    expect(
      isAllowedPublishOrigin(
        'https://edu-team-tms-aioe1cjkb-okestro-edu-tms-v2-s-projects.vercel.app/admin'
      )
    ).toBe(true);
    expect(
      isAllowedPublishOrigin(
        'https://edu-team-tms-ten-git-chore-76fd64-okestro-edu-tms-v2-s-projects.vercel.app/admin?module=journal'
      )
    ).toBe(true);
  });

  it('blocks unknown origins', () => {
    expect(isAllowedPublishOrigin('https://evil.example.com')).toBe(false);
    expect(isAllowedPublishOrigin('https://edu-team-tms-abc123.vercel.app')).toBe(false);
    expect(isAllowedPublishOrigin('https://attacker.vercel.app')).toBe(false);
    expect(isAllowedPublishOrigin('')).toBe(false);
  });

  it('does not allow origin prefix spoofing', () => {
    expect(isAllowedPublishOrigin('https://edu-team-tms-ten.vercel.app.evil.example/?mode=edit')).toBe(false);
  });

  it('allows TMS_PUBLISH_ALLOWED_ORIGINS extras', () => {
    const prev = process.env.TMS_PUBLISH_ALLOWED_ORIGINS;
    process.env.TMS_PUBLISH_ALLOWED_ORIGINS = 'https://tms.example.com';
    try {
      expect(isAllowedPublishOrigin('https://tms.example.com/?mode=edit')).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.TMS_PUBLISH_ALLOWED_ORIGINS;
      else process.env.TMS_PUBLISH_ALLOWED_ORIGINS = prev;
    }
  });
});
