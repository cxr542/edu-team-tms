import { describe, expect, it } from 'vitest';
import {
  getBlobReadWriteToken,
  getBlobSdkOptions,
  isBlobConfigured,
} from '../server/api-utils/blobClient.js';

describe('blobClient', () => {
  it('uses static token when BLOB_READ_WRITE_TOKEN is set', () => {
    const prev = process.env.BLOB_READ_WRITE_TOKEN;
    process.env.BLOB_READ_WRITE_TOKEN = 'rw_test';
    try {
      expect(getBlobReadWriteToken()).toBe('rw_test');
      expect(isBlobConfigured()).toBe(true);
      expect(getBlobSdkOptions()).toEqual({ token: 'rw_test' });
    } finally {
      if (prev === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
      else process.env.BLOB_READ_WRITE_TOKEN = prev;
    }
  });

  it('supports OIDC via BLOB_STORE_ID without read-write token', () => {
    const prevToken = process.env.BLOB_READ_WRITE_TOKEN;
    const prevStore = process.env.BLOB_STORE_ID;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    process.env.BLOB_STORE_ID = 'store_u88rzqoycocpwn7c';
    try {
      expect(isBlobConfigured()).toBe(true);
      expect(getBlobSdkOptions()).toEqual({});
    } finally {
      if (prevToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
      else process.env.BLOB_READ_WRITE_TOKEN = prevToken;
      if (prevStore === undefined) delete process.env.BLOB_STORE_ID;
      else process.env.BLOB_STORE_ID = prevStore;
    }
  });
});
