import { afterEach, describe, expect, it, vi } from 'vitest';

const REQ_ID = '11111111-1111-4111-8111-111111111111';
const PATH = `${REQ_ID}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-shot.png`;

function makeFile(over = {}) {
  return { name: 'shot.png', size: 500, type: 'image/png', ...over };
}

function makeStorageClient({ uploadError = null, uploadThrows = false } = {}) {
  const uploadToSignedUrl = vi.fn(async () => {
    if (uploadThrows) throw new Error('storage exploded');
    return { data: { path: PATH }, error: uploadError };
  });
  const from = vi.fn(() => ({ uploadToSignedUrl }));
  const anonWrite = vi.fn(() => {
    throw new Error('anon client must not write rows');
  });
  return { client: { storage: { from }, from: anonWrite }, uploadToSignedUrl, storageFrom: from, anonWrite };
}

async function loadModule(client, configured = true) {
  vi.resetModules();
  vi.doMock('../src/utils/supabaseClient.js', () => ({
    isSupabaseConfigured: configured,
    getSupabaseClient: () => client,
  }));
  return import('../src/utils/csrAttachmentsSupabase.js');
}

const respond = (status, body) => ({ ok: status < 400, status, json: async () => body });

/** fetch 응답을 호출 순서대로 돌려준다(sign → register). */
function stubFetch(...responses) {
  const queue = [...responses];
  const fn = vi.fn(async () => {
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const signOk = () => respond(200, { ok: true, status: 'ok', data: { path: PATH, token: 'tok-1' } });
const registerOk = () =>
  respond(200, {
    ok: true,
    status: 'ok',
    data: {
      id: 'att-1',
      request_id: REQ_ID,
      file_name: 'shot.png',
      storage_path: PATH,
      file_size_bytes: 500,
      content_type: 'image/png',
      uploaded_by: 'B',
      created_at: '2026-11-23T00:00:00.000Z',
    },
  });

describe('csrAttachmentsSupabase upload', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('signs, uploads with the token, then registers — in that order', async () => {
    const { client, uploadToSignedUrl, storageFrom, anonWrite } = makeStorageClient();
    const fetchMock = stubFetch(signOk(), registerOk());
    const mod = await loadModule(client);
    const file = makeFile();

    const result = await mod.uploadCsrAttachmentToSupabase({ requestId: REQ_ID, file, uploadedBy: '해커' });

    expect(result).toMatchObject({
      ok: true,
      status: 'ok',
      data: { id: 'att-1', requestId: REQ_ID, fileName: 'shot.png', storagePath: PATH, uploadedBy: 'B' },
    });

    const [signUrl, signInit] = fetchMock.mock.calls[0];
    expect(signUrl).toBe('/api/csr-attachments');
    expect(signInit.method).toBe('POST');
    expect(signInit.credentials).toBe('same-origin');
    expect(JSON.parse(signInit.body)).toEqual({
      action: 'sign',
      requestId: REQ_ID,
      fileName: 'shot.png',
      size: 500,
      contentType: 'image/png',
    });

    expect(storageFrom).toHaveBeenCalledWith('csr-attachments');
    expect(uploadToSignedUrl).toHaveBeenCalledWith(PATH, 'tok-1', file, { contentType: 'image/png' });

    const [, registerInit] = fetchMock.mock.calls[1];
    const registerBody = JSON.parse(registerInit.body);
    expect(registerBody).toEqual({
      action: 'register',
      requestId: REQ_ID,
      fileName: 'shot.png',
      size: 500,
      contentType: 'image/png',
      path: PATH,
    });
    // 올린 사람은 서버가 정한다: 클라이언트가 보낸 값은 어디에도 실리지 않는다.
    expect(JSON.stringify(registerBody)).not.toContain('해커');
    expect(anonWrite).not.toHaveBeenCalled();
  });

  it('omits the content type when the file has none and falls back for the storage upload', async () => {
    const { client, uploadToSignedUrl } = makeStorageClient();
    const fetchMock = stubFetch(signOk(), registerOk());
    const mod = await loadModule(client);

    await mod.uploadCsrAttachmentToSupabase({ requestId: REQ_ID, file: makeFile({ type: '' }) });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('contentType');
    expect(uploadToSignedUrl.mock.calls[0][3]).toEqual({ contentType: 'application/octet-stream' });
  });

  it('stops at sign failures and shows the server message (403 forbidden, 409 limit)', async () => {
    for (const [status, code, message] of [
      [403, 'forbidden', '본인 요청에만 첨부할 수 있습니다.'],
      [409, 'conflict', '요청당 첨부파일은 최대 5개까지 가능합니다.'],
      [404, 'not-found', '요청을 찾을 수 없습니다.'],
    ]) {
      const { client, uploadToSignedUrl } = makeStorageClient();
      const fetchMock = stubFetch(respond(status, { ok: false, status: code, message }));
      const mod = await loadModule(client);

      const result = await mod.uploadCsrAttachmentToSupabase({ requestId: REQ_ID, file: makeFile() });

      expect(result).toMatchObject({ ok: false, message });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(uploadToSignedUrl).not.toHaveBeenCalled();
    }
  });

  it('does not register when the storage upload fails or throws', async () => {
    for (const options of [{ uploadError: { message: 'upload denied' } }, { uploadThrows: true }]) {
      const { client } = makeStorageClient(options);
      const fetchMock = stubFetch(signOk(), registerOk());
      const mod = await loadModule(client);

      const result = await mod.uploadCsrAttachmentToSupabase({ requestId: REQ_ID, file: makeFile() });

      expect(result.ok).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1); // register 는 부르지 않는다
    }
  });

  it('reports a register failure after the upload (conflict keeps the server message)', async () => {
    const { client, uploadToSignedUrl } = makeStorageClient();
    stubFetch(signOk(), respond(409, { ok: false, status: 'conflict', message: '업로드된 파일을 찾을 수 없습니다.' }));
    const mod = await loadModule(client);

    const result = await mod.uploadCsrAttachmentToSupabase({ requestId: REQ_ID, file: makeFile() });

    expect(uploadToSignedUrl).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: false, status: 'conflict', message: '업로드된 파일을 찾을 수 없습니다.' });
  });

  it('fails cleanly when the sign response has no path or token, and on network errors', async () => {
    let { client, uploadToSignedUrl } = makeStorageClient();
    stubFetch(respond(200, { ok: true, status: 'ok', data: { path: PATH } }));
    let mod = await loadModule(client);
    let result = await mod.uploadCsrAttachmentToSupabase({ requestId: REQ_ID, file: makeFile() });
    expect(result.ok).toBe(false);
    expect(uploadToSignedUrl).not.toHaveBeenCalled();

    ({ client, uploadToSignedUrl } = makeStorageClient());
    stubFetch(new Error('Failed to fetch'));
    mod = await loadModule(client);
    result = await mod.uploadCsrAttachmentToSupabase({ requestId: REQ_ID, file: makeFile() });
    expect(result).toMatchObject({ ok: false, status: 'error', message: 'Failed to fetch' });
    expect(uploadToSignedUrl).not.toHaveBeenCalled();
  });

  it('validates input before calling the server and skips it when Supabase is not configured', async () => {
    const { client } = makeStorageClient();
    const fetchMock = stubFetch(signOk(), registerOk());
    let mod = await loadModule(client);

    expect((await mod.uploadCsrAttachmentToSupabase({ file: makeFile() })).ok).toBe(false);
    expect((await mod.uploadCsrAttachmentToSupabase({ requestId: REQ_ID })).ok).toBe(false);
    expect((await mod.uploadCsrAttachmentToSupabase({ requestId: REQ_ID, file: makeFile({ size: 0 }) })).ok).toBe(false);
    expect(
      (await mod.uploadCsrAttachmentToSupabase({ requestId: REQ_ID, file: makeFile({ size: 10 * 1024 * 1024 + 1 }) })).ok
    ).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    mod = await loadModule(null, false);
    expect((await mod.uploadCsrAttachmentToSupabase({ requestId: REQ_ID, file: makeFile() })).status).toBe('disabled');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
