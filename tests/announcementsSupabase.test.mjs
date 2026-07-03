import { describe, expect, it, vi } from 'vitest';

function makeQuery(result) {
  const query = {
    order: vi.fn(() => query),
    eq: vi.fn(() => query),
    select: vi.fn(() => query),
    upsert: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

async function loadModule(client) {
  vi.resetModules();
  vi.doMock('../src/utils/supabaseClient.js', () => ({
    getSupabaseClient: () => client,
    isSupabaseConfigured: true,
  }));
  return import('../src/utils/announcementsSupabase.js');
}

describe('announcementsSupabase', () => {
  it('builds and normalizes announcement payloads', async () => {
    const { buildAnnouncementDraft, normalizeAnnouncement } = await loadModule({});

    const draft = buildAnnouncementDraft({
      title: '7월 릴리즈 노트',
      body: '공지사항 기능이 추가되었습니다.',
      category: 'release',
      author: '신혜윤',
      authorCode: 'C',
      isPinned: true,
      isPublished: true,
    });

    expect(draft.ok).toBe(true);
    expect(draft.data).toMatchObject({
      title: '7월 릴리즈 노트',
      body: '공지사항 기능이 추가되었습니다.',
      category: 'release',
      isPinned: true,
      isPublished: true,
      author: '신혜윤',
      authorCode: 'C',
    });

    expect(
      normalizeAnnouncement({
        id: '1',
        title: '장애 안내',
        body: '  로그인 오류가 있었습니다.  ',
        category: 'incident',
        is_pinned: true,
        is_published: true,
        author: '신혜윤',
        author_code: 'C',
        published_at: '2026-07-01T00:00:00.000Z',
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-02T00:00:00.000Z',
      })
    ).toMatchObject({
      id: '1',
      body: '로그인 오류가 있었습니다.',
      category: 'incident',
      isPinned: true,
      isPublished: true,
      author: '신혜윤',
      authorCode: 'C',
      publishedAt: '2026-07-01T00:00:00.000Z',
      categoryLabel: '장애안내',
    });
  });

  it('upserts announcement rows with pinned and publish fields', async () => {
    let query;
    const client = {
      from: vi.fn(() => {
        query = makeQuery({
          data: {
            id: 'ann-1',
            title: '공지사항',
            body: '본문',
            category: 'notice',
            is_pinned: true,
            is_published: true,
            author: '신혜윤',
            author_code: 'C',
            published_at: '2026-07-03T00:00:00.000Z',
            created_at: '2026-07-03T00:00:00.000Z',
            updated_at: '2026-07-03T00:00:00.000Z',
          },
          error: null,
        });
        return query;
      }),
    };
    const mod = await loadModule(client);

    const result = await mod.upsertAnnouncementToSupabase({
      id: 'ann-1',
      title: '공지사항',
      body: '본문',
      category: 'notice',
      isPinned: true,
      isPublished: true,
      author: '신혜윤',
      authorCode: 'C',
      publishedAt: null,
      createdAt: '2026-07-03T00:00:00.000Z',
      updatedAt: '2026-07-03T00:00:00.000Z',
    });

    expect(client.from).toHaveBeenCalledWith('announcements');
    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        author: '신혜윤',
        author_code: 'C',
        is_pinned: true,
        is_published: true,
      }),
      { onConflict: 'id' }
    );
    expect(result).toMatchObject({
      ok: true,
      status: 'ok',
      data: {
        id: 'ann-1',
        authorCode: 'C',
        isPinned: true,
        isPublished: true,
      },
    });
  });

  it('filters member queries to published announcements only', async () => {
    let query;
    const client = {
      from: vi.fn(() => {
        query = makeQuery({
          data: [
            {
              id: 'ann-1',
              title: '공지',
              body: '내용',
              category: 'notice',
              is_pinned: false,
              is_published: true,
              author: '신혜윤',
              author_code: 'C',
              created_at: '2026-07-03T00:00:00.000Z',
              updated_at: '2026-07-03T00:00:00.000Z',
              published_at: '2026-07-03T00:00:00.000Z',
            },
          ],
          error: null,
        });
        return query;
      }),
    };
    const mod = await loadModule(client);
    const result = await mod.listAnnouncementsFromSupabase({ includeUnpublished: false });

    expect(query.eq).toHaveBeenCalledWith('is_published', true);
    expect(result).toMatchObject({
      ok: true,
      status: 'ok',
      data: [{ id: 'ann-1', isPublished: true }],
    });
  });

  it('loads all announcements for managers and keeps pinned order first', async () => {
    let query;
    const client = {
      from: vi.fn(() => {
        query = makeQuery({
          data: [
            {
              id: 'ann-2',
              title: '최근 공지',
              body: '내용',
              category: 'guide',
              is_pinned: false,
              is_published: false,
              author: '신혜윤',
              author_code: 'C',
              created_at: '2026-07-03T00:00:00.000Z',
              updated_at: '2026-07-03T00:00:00.000Z',
              published_at: null,
            },
            {
              id: 'ann-1',
              title: '고정 공지',
              body: '내용',
              category: 'notice',
              is_pinned: true,
              is_published: true,
              author: '신혜윤',
              author_code: 'C',
              created_at: '2026-07-02T00:00:00.000Z',
              updated_at: '2026-07-02T00:00:00.000Z',
              published_at: '2026-07-02T00:00:00.000Z',
            },
          ],
          error: null,
        });
        return query;
      }),
    };
    const mod = await loadModule(client);
    const result = await mod.listAnnouncementsFromSupabase({ includeUnpublished: true });

    expect(query.eq).not.toHaveBeenCalled();
    expect(result.data.map((item) => item.id)).toEqual(['ann-1', 'ann-2']);
  });

  it('preserves category and publish state when updating', async () => {
    let query;
    const client = {
      from: vi.fn(() => {
        query = makeQuery({
          data: {
            id: 'ann-1',
            title: '공지',
            body: '본문',
            category: 'release',
            is_pinned: true,
            is_published: false,
            author: '신혜윤',
            author_code: 'C',
            created_at: '2026-07-01T00:00:00.000Z',
            updated_at: '2026-07-04T00:00:00.000Z',
            published_at: '2026-07-02T00:00:00.000Z',
          },
          error: null,
        });
        return query;
      }),
    };
    const mod = await loadModule(client);

    const result = await mod.updateAnnouncementInSupabase({
      announcement: {
        id: 'ann-1',
        title: '공지',
        body: '본문',
        category: 'release',
        isPinned: false,
        isPublished: false,
        author: '신혜윤',
        authorCode: 'C',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-03T00:00:00.000Z',
        publishedAt: '2026-07-02T00:00:00.000Z',
      },
      id: 'ann-1',
      patch: {
        isPinned: true,
        isPublished: false,
        category: 'release',
      },
    });

    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'release',
        is_pinned: true,
        is_published: false,
        published_at: '2026-07-02T00:00:00.000Z',
      }),
      { onConflict: 'id' }
    );
    expect(result).toMatchObject({
      ok: true,
      status: 'ok',
      data: {
        id: 'ann-1',
        category: 'release',
        isPinned: true,
        isPublished: false,
      },
    });
  });
});
