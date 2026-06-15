import { describe, expect, it } from 'vitest';
import { isAllowedPublishOrigin } from '../api/utils/publishOrigin.js';

describe('isAllowedPublishOrigin', () => {
  it('allows localhost and any vercel.app deployment', () => {
    expect(isAllowedPublishOrigin('http://localhost:3000/')).toBe(true);
    expect(isAllowedPublishOrigin('https://okestro-edu-team-tms.vercel.app/?mode=edit')).toBe(true);
    expect(isAllowedPublishOrigin('https://edu-team-tms-new.vercel.app/?mode=edit')).toBe(true);
    expect(isAllowedPublishOrigin('https://edu-team-tms-abc123.vercel.app')).toBe(true);
  });

  it('blocks unknown origins', () => {
    expect(isAllowedPublishOrigin('https://evil.example.com')).toBe(false);
    expect(isAllowedPublishOrigin('')).toBe(false);
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
