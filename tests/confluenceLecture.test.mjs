import { describe, expect, it, vi } from 'vitest';
import handler from '../api/confluence-lecture.js';
import {
  buildBasicAuthHeader,
  buildWebUiUrl,
  normalizeChildItem,
  resolveConfluenceConfig,
  sanitizeContentId,
} from '../server/api-utils/confluenceLecture.js';

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(chunk) {
      this.body = chunk;
    },
  };
}

function parseBody(res) {
  return JSON.parse(res.body || '{}');
}

describe('confluenceLecture utils', () => {
  it('resolves config and defaults folder id', () => {
    const cfg = resolveConfluenceConfig({
      CONFLUENCE_EMAIL: 'a@example.com',
      CONFLUENCE_API_TOKEN: 'tok',
    });
    expect(cfg.configured).toBe(true);
    expect(cfg.folderId).toBe('1867843025');
    expect(cfg.parentType).toBe('folder');
    expect(cfg.spaceKey).toBe('rDzwjbV6p8qL');
  });

  it('marks unconfigured when token missing', () => {
    expect(resolveConfluenceConfig({ CONFLUENCE_EMAIL: 'a@example.com' }).configured).toBe(false);
  });

  it('builds basic auth and web ui urls', () => {
    expect(buildBasicAuthHeader('u@x.com', 'secret')).toMatch(/^Basic /);
    expect(
      buildWebUiUrl({
        baseUrl: 'https://okestro.atlassian.net',
        spaceKey: 'rDzwjbV6p8qL',
        type: 'page',
        id: '2694807588',
      })
    ).toBe('https://okestro.atlassian.net/wiki/spaces/rDzwjbV6p8qL/pages/2694807588');
    expect(
      buildWebUiUrl({
        baseUrl: 'https://okestro.atlassian.net',
        spaceKey: 'rDzwjbV6p8qL',
        type: 'folder',
        id: '1867843025',
      })
    ).toBe('https://okestro.atlassian.net/wiki/spaces/rDzwjbV6p8qL/folder/1867843025');
  });

  it('sanitizes content ids', () => {
    expect(sanitizeContentId('1867843025')).toBe('1867843025');
    expect(sanitizeContentId('../etc')).toBe('');
    expect(sanitizeContentId('abc')).toBe('');
  });

  it('normalizes child items', () => {
    const row = normalizeChildItem(
      { id: '1', type: 'folder', title: '26년 강의일지', status: 'current' },
      { baseUrl: 'https://okestro.atlassian.net', spaceKey: 'rDzwjbV6p8qL' }
    );
    expect(row.webUi).toContain('/folder/1');
    expect(row.title).toBe('26년 강의일지');
  });
});

describe('api/confluence-lecture handler', () => {
  it('rejects non-GET', async () => {
    const res = mockRes();
    await handler({ method: 'POST', headers: { referer: 'http://localhost:3000/' }, url: '/api/confluence-lecture' }, res);
    expect(res.statusCode).toBe(405);
  });

  it('rejects bad referer', async () => {
    const res = mockRes();
    await handler(
      { method: 'GET', headers: { referer: 'https://evil.example/' }, url: '/api/confluence-lecture' },
      res,
      { env: { CONFLUENCE_EMAIL: 'a@x.com', CONFLUENCE_API_TOKEN: 't' } }
    );
    expect(res.statusCode).toBe(403);
  });

  it('returns available:false when env missing', async () => {
    const res = mockRes();
    await handler(
      { method: 'GET', headers: { referer: 'http://localhost:3000/yhkim' }, url: '/api/confluence-lecture' },
      res,
      { env: {} }
    );
    expect(res.statusCode).toBe(503);
    expect(parseBody(res).available).toBe(false);
  });

  it('lists children via mocked fetch', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          results: [
            { id: '2748514320', type: 'folder', title: '26년 강의일지', status: 'current' },
          ],
        }),
    }));
    const res = mockRes();
    await handler(
      {
        method: 'GET',
        headers: { referer: 'https://edu-team-tms-ten.vercel.app/yhkim' },
        url: '/api/confluence-lecture?action=list',
      },
      res,
      {
        env: {
          CONFLUENCE_EMAIL: 'a@x.com',
          CONFLUENCE_API_TOKEN: 't',
          CONFLUENCE_LECTURE_FOLDER_ID: '1867843025',
        },
        fetchImpl,
      }
    );
    expect(res.statusCode).toBe(200);
    const body = parseBody(res);
    expect(body.available).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].title).toBe('26년 강의일지');
    expect(fetchImpl).toHaveBeenCalled();
    const calledUrl = String(fetchImpl.mock.calls[0][0]);
    expect(calledUrl).toContain('/wiki/api/v2/folders/1867843025/direct-children');
  });

  it('lists requested children only after resolving the parent under the root folder', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const href = String(url);
      if (href.includes('/wiki/api/v2/folders/1867843025/direct-children')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              results: [
                { id: '2748514320', type: 'folder', title: '26년 강의일지', status: 'current' },
              ],
            }),
        };
      }
      if (href.includes('/wiki/api/v2/folders/2748514320/direct-children')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              results: [
                { id: '2748514333', type: 'page', title: '7월 강의일지', status: 'current' },
              ],
            }),
        };
      }
      return {
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ message: 'not found' }),
      };
    });
    const res = mockRes();
    await handler(
      {
        method: 'GET',
        headers: { referer: 'https://edu-team-tms-ten.vercel.app/yhkim' },
        url: '/api/confluence-lecture?action=list&parentId=2748514320&parentType=folder',
      },
      res,
      {
        env: {
          CONFLUENCE_EMAIL: 'a@x.com',
          CONFLUENCE_API_TOKEN: 't',
          CONFLUENCE_LECTURE_FOLDER_ID: '1867843025',
        },
        fetchImpl,
      }
    );

    expect(res.statusCode).toBe(200);
    const body = parseBody(res);
    expect(body.parentId).toBe('2748514320');
    expect(body.items).toHaveLength(1);
    expect(String(fetchImpl.mock.calls[0][0])).toContain(
      '/wiki/api/v2/folders/1867843025/direct-children'
    );
    expect(String(fetchImpl.mock.calls[1][0])).toContain(
      '/wiki/api/v2/folders/2748514320/direct-children'
    );
  });

  it('rejects requested parent ids outside the lecture root', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          results: [
            { id: '2748514320', type: 'folder', title: '26년 강의일지', status: 'current' },
          ],
        }),
    }));
    const res = mockRes();
    await handler(
      {
        method: 'GET',
        headers: { referer: 'https://edu-team-tms-ten.vercel.app/yhkim' },
        url: '/api/confluence-lecture?action=list&parentId=999999999&parentType=folder',
      },
      res,
      {
        env: {
          CONFLUENCE_EMAIL: 'a@x.com',
          CONFLUENCE_API_TOKEN: 't',
          CONFLUENCE_LECTURE_FOLDER_ID: '1867843025',
        },
        fetchImpl,
      }
    );

    expect(res.statusCode).toBe(403);
    expect(parseBody(res)).toMatchObject({ available: false, items: [] });
    const calledUrls = fetchImpl.mock.calls.map(([url]) => String(url));
    expect(calledUrls).toHaveLength(2);
    expect(calledUrls.some((url) => url.includes('/wiki/api/v2/folders/999999999/'))).toBe(false);
  });

  it('rejects invalid parentId', async () => {
    const res = mockRes();
    await handler(
      {
        method: 'GET',
        headers: { referer: 'http://localhost:3000/' },
        url: '/api/confluence-lecture?parentId=not-a-number',
      },
      res,
      { env: { CONFLUENCE_EMAIL: 'a@x.com', CONFLUENCE_API_TOKEN: 't' } }
    );
    expect(res.statusCode).toBe(400);
  });
});
