import { describe, expect, it } from 'vitest';

import {
  createMockMSGraphClientFactory,
  createMockSPHttpClient,
  LOCAL_GRAPH_DATA,
  type MockTransport
} from '../src/http.js';

describe('MockMSGraphClient', () => {
  it('exposes lowercase orderby only (the real GraphRequest API has no orderBy)', async () => {
    const client = await createMockMSGraphClientFactory({}).getClient();
    const req = client.api('/me');
    expect(typeof req.orderby).toBe('function');
    expect('orderBy' in req).toBe(false);
  });

  it('returns the same chainable request object from every query-builder method', async () => {
    const client = await createMockMSGraphClientFactory({}).getClient();
    const req = client.api('/me');
    expect(req.select('displayName,mail')).toBe(req);
    expect(req.filter("startsWith(displayName,'D')")).toBe(req);
    expect(req.expand('manager')).toBe(req);
    expect(req.top(5)).toBe(req);
    expect(req.version('v1.0')).toBe(req);
    expect(req.orderby('displayName')).toBe(req);
    expect(req.query({ custom: 'x' })).toBe(req);
    expect(req.count(true)).toBe(req);
    expect(req.skip(10)).toBe(req);
    expect(req.skipToken('abc')).toBe(req);
    expect(req.responseType('blob')).toBe(req);
    expect(req.header('X-Custom', 'yes')).toBe(req);
    expect(req.headers({ 'X-Other': 'no' })).toBe(req);
  });

  it('builds the request path with the v4 query parameters', async () => {
    const client = await createMockMSGraphClientFactory({}).getClient();
    await client
      .api('/me')
      .select('displayName,mail')
      .expand('manager')
      .orderby('displayName')
      .top(5)
      .count(true)
      .skip(10)
      .skipToken('abc')
      .query({ custom: 'x' })
      .get();
    expect(client.lastRequestPath).toContain('$select=displayName,mail');
    expect(client.lastRequestPath).toContain('$expand=manager');
    expect(client.lastRequestPath).toContain('$orderby=displayName');
    expect(client.lastRequestPath).toContain('$top=5');
    expect(client.lastRequestPath).toContain('$count=true');
    expect(client.lastRequestPath).toContain('$skip=10');
    expect(client.lastRequestPath).toContain('$skiptoken=abc');
    expect(client.lastRequestPath).toContain('custom=x');
  });

  it('records responseType and headers on the request without touching the query string', async () => {
    const client = await createMockMSGraphClientFactory({}).getClient();
    const req = client.api('/me').responseType('blob').header('X-Custom', 'yes').headers({ 'X-Other': 'no' });
    await req.get();
    expect(req.requestResponseType).toBe('blob');
    expect(req.requestHeaders).toEqual({ 'X-Custom': 'yes', 'X-Other': 'no' });
    expect(client.lastRequestPath).toBe('/me');
  });

  it('del/update/create dispatch the same verbs and handlers as delete/patch/post', async () => {
    const client = await createMockMSGraphClientFactory(LOCAL_GRAPH_DATA).getClient();
    const me = '/v1.0/me';
    const payload = { displayName: 'Renamed' };

    await client.api(me).delete();
    expect(client.lastRequestMethod).toBe('DELETE');
    await client.api(me).del();
    expect(client.lastRequestMethod).toBe('DELETE');

    await client.api(me).patch(payload);
    expect(client.lastRequestMethod).toBe('PATCH');
    await client.api(me).update(payload);
    expect(client.lastRequestMethod).toBe('PATCH');

    await client.api(me).post(payload);
    expect(client.lastRequestMethod).toBe('POST');
    await client.api(me).create(payload);
    expect(client.lastRequestMethod).toBe('POST');

    expect(await client.api(me).del()).toBe(await client.api(me).delete());
    expect(await client.api(me).update(payload)).toEqual(await client.api(me).patch(payload));
    expect(await client.api(me).create(payload)).toEqual(await client.api(me).post(payload));
  });

  it('getClient accepts an optional version argument and returns the same client instance', async () => {
    const factory = createMockMSGraphClientFactory({});
    const [plain, v1, v3] = await Promise.all([factory.getClient(), factory.getClient('1'), factory.getClient('3')]);
    expect(v1).toBe(plain);
    expect(v3).toBe(plain);
  });
});

describe('MockSPHttpClient', () => {
  it('sends the real SPHttpClient v4 headers on get', async () => {
    const calls: RequestInit[] = [];
    const transport: MockTransport = (url, init) => {
      calls.push(init ?? {});
      return Promise.resolve(new Response('{}', { status: 200 }));
    };
    const client = createMockSPHttpClient(transport);

    await client.get(1, 'http://localhost/_api/web', {});

    expect(calls[0]!.headers).toMatchObject({
      Accept: 'application/json;odata.metadata=minimal',
      'OData-Version': '4.0'
    });
  });

  it('sends the v4 Content-Type on post', async () => {
    const calls: RequestInit[] = [];
    const transport: MockTransport = (url, init) => {
      calls.push(init ?? {});
      return Promise.resolve(new Response('{}', { status: 200 }));
    };
    const client = createMockSPHttpClient(transport);

    await client.post(1, 'http://localhost/_api/web', { body: '{"title":"x"}' });

    expect(calls[0]!.headers).toMatchObject({
      Accept: 'application/json;odata.metadata=minimal',
      'OData-Version': '4.0',
      'Content-Type': 'application/json;odata.metadata=minimal'
    });
  });
});
