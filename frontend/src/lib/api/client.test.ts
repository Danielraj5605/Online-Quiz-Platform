import { api, ApiError, refreshSession, tokenStore, setSessionListener } from './client';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const authResult = { user: { id: '1' }, accessToken: 'new-token' };
const authHeader = (call: unknown[]) => ((call[1] as RequestInit).headers as Record<string, string>).Authorization;

beforeEach(() => { tokenStore.set('old-token'); setSessionListener(() => {}); });
afterEach(() => vi.restoreAllMocks());

describe('api client', () => {
  it('unwraps { data } and sends the bearer token', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { data: { hello: 'world' } }));
    expect(await api.get('/x')).toEqual({ hello: 'world' });
    expect(authHeader(f.mock.calls[0]!)).toBe('Bearer old-token');
  });

  it('on 401 refreshes once, then retries with the new token', async () => {
    const f = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } }))
      .mockResolvedValueOnce(json(200, { data: authResult }))
      .mockResolvedValueOnce(json(200, { data: { ok: true } }));
    expect(await api.get('/secret')).toEqual({ ok: true });
    expect(f).toHaveBeenCalledTimes(3);
    expect(String(f.mock.calls[1]![0])).toContain('/auth/refresh');
    expect(authHeader(f.mock.calls[2]!)).toBe('Bearer new-token');
  });

  it('single-flights concurrent refreshes', async () => {
    await new Promise((r) => setTimeout(r, 5)); // let the previous test's in-flight marker clear
    const f = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
      String(url).includes('/auth/refresh') ? json(200, { data: authResult }) : json(200, { data: 1 }));
    await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(f.mock.calls.filter(([u]) => String(u).includes('/auth/refresh'))).toHaveLength(1);
  });

  it('throws a typed ApiError and reports a dead session when refresh fails', async () => {
    const listener = vi.fn();
    setSessionListener(listener);
    await new Promise((r) => setTimeout(r, 5)); // let any previous single-flight settle
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } }))
      .mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHORIZED', message: 'no session' } }));
    await expect(api.get('/secret')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(listener).toHaveBeenCalledWith(null);
    expect(tokenStore.get()).toBeNull();
  });

  it('exposes zod field errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(400, { error: { code: 'BAD_REQUEST', message: 'Invalid body', details: [{ path: 'email', message: 'Bad email' }] } }));
    const err = await api.post('/x', {}, { noRefresh: true }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).fieldErrors).toEqual({ email: 'Bad email' });
  });

  it('wraps network failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api.get('/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK' });
  });
});
