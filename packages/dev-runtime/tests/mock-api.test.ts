import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockSharePointApi, type MockApiRequest, type MockApiResponse } from '../src/mock-api.js';

interface FakeResponse extends MockApiResponse {
  statusCode?: number;
  headers: Record<string, string>;
  body: string;
}

function makeRes(): FakeResponse {
  return {
    headers: {},
    body: '',
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    end(body?: string) {
      this.body = body ?? '';
    }
  };
}

function makeReq(overrides: Partial<MockApiRequest> = {}): MockApiRequest {
  return { url: '/_api/web', method: 'GET', ...overrides };
}

async function call(api: ReturnType<typeof createMockSharePointApi>, req: MockApiRequest): Promise<FakeResponse> {
  const res = makeRes();
  await api.handle(req, res);
  return res;
}

function json(res: FakeResponse): unknown {
  return JSON.parse(res.body);
}

describe('createMockSharePointApi', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rspfx-mock-api-'));
  let api: ReturnType<typeof createMockSharePointApi>;

  beforeEach(() => {
    api = createMockSharePointApi({ projectRoot, origin: () => 'http://localhost:4321' });
  });

  it('serves web info as a top-level object without a d envelope', async () => {
    const res = await call(api, makeReq({ url: '/_api/web' }));
    expect(res.statusCode).toBe(200);
    const data = json(res) as Record<string, unknown>;
    expect(data.d).toBeUndefined();
    expect(data.Title).toBe('Local Workbench');
    expect(data.ServerRelativeUrl).toBe('/');
    expect(data.WebTemplate).toBe('GROUP');
    expect(data.Language).toBe(1033);
  });

  it('serves the list collection as { value: [...] }', async () => {
    const res = await call(api, makeReq({ url: '/_api/web/lists' }));
    const data = json(res) as { value: Record<string, unknown>[] };
    expect(data.value).toHaveLength(2);
    expect(data.value[0]!.Title).toBe('Announcements');
    expect(data.value[0]!.ItemCount).toBe(2);
    expect(data.value[0]!.ListItemEntityTypeFullName).toBe('SP.Data.AnnouncementsListItem');
    expect(data.value[0]!.BaseType).toBe(0);
  });

  it('returns a single list for getByTitle and 404s for unknown titles', async () => {
    const list = await call(api, makeReq({ url: "/_api/web/lists/getbytitle('Announcements')" }));
    expect(list.statusCode).toBe(200);
    expect(json(list)).toMatchObject({
      Id: '3d81f5a1-0000-0000-0000-000000000010',
      Title: 'Announcements',
      ServerRelativeUrl: '/Lists/Announcements'
    });

    const missing = await call(api, makeReq({ url: "/_api/web/lists/getbytitle('Nope')" }));
    expect(missing.statusCode).toBe(404);
    expect(json(missing)).toMatchObject({
      error: {
        code: '-1, System.IO.FileNotFoundException',
        message: { lang: 'en-US', value: "List 'Nope' does not exist at site with URL 'http://localhost:4321'" }
      }
    });
  });

  it('serves a single list by guid', async () => {
    const res = await call(
      api,
      makeReq({ url: "/_api/web/lists(guid'3d81f5a1-0000-0000-0000-000000000011')" })
    );
    expect(res.statusCode).toBe(200);
    expect(json(res)).toMatchObject({ Id: '3d81f5a1-0000-0000-0000-000000000011', Title: 'Documents' });

    const missing = await call(api, makeReq({ url: "/_api/web/lists(guid'00000000-0000-0000-0000-000000000000')" }));
    expect(missing.statusCode).toBe(404);
  });

  it('returns items as { value: [...] } including seeded custom fields', async () => {
    const res = await call(api, makeReq({ url: "/_api/web/lists/getbytitle('Announcements')/items" }));
    const data = json(res) as { value: Record<string, unknown>[] };
    expect(data.value).toHaveLength(2);
    expect(data.value[0]).toMatchObject({
      Id: 1,
      Title: 'Welcome to RSPFx',
      Body: 'Local preview running without SharePoint.',
      OData__UIVersionString: '1.0',
      Attachments: false,
      GUID: expect.any(String)
    });
  });

  it('serves a single item by index and 404s for unknown indices', async () => {
    const item = await call(api, makeReq({ url: "/_api/web/lists/getbytitle('Announcements')/items(1)" }));
    expect(item.statusCode).toBe(200);
    expect(json(item)).toMatchObject({ Id: 1, Title: 'Welcome to RSPFx', Body: 'Local preview running without SharePoint.' });

    const missing = await call(api, makeReq({ url: "/_api/web/lists/getbytitle('Announcements')/items(99)" }));
    expect(missing.statusCode).toBe(404);
    expect(json(missing)).toMatchObject({ error: { code: '-1, System.IO.FileNotFoundException' } });
  });

  it('creates items via POST with a 201 and an assigned Id', async () => {
    const created = await call(
      api,
      makeReq({
        url: "/_api/web/lists/getbytitle('Announcements')/items",
        method: 'POST',
        headers: { 'X-RequestDigest': '0xRSPFXLOCALPREVIEW', 'Content-Type': 'application/json' },
        body: JSON.stringify({ Title: 'Third item' })
      })
    );
    expect(created.statusCode).toBe(201);
    const createdData = json(created) as { Id: number; Title: string };
    expect(createdData.Title).toBe('Third item');
    expect(createdData.Id).toBe(3);

    const items = await call(api, makeReq({ url: "/_api/web/lists/getbytitle('Announcements')/items" }));
    const itemsData = json(items) as { value: { Title: string }[] };
    expect(itemsData.value).toHaveLength(3);
    expect(itemsData.value[2]!.Title).toBe('Third item');
  });

  it('updates items via X-HTTP-Method MERGE/PUT and deletes via X-HTTP-Method DELETE', async () => {
    const merged = await call(
      api,
      makeReq({
        url: "/_api/web/lists/getbytitle('Announcements')/items(1)",
        method: 'POST',
        headers: { 'X-HTTP-Method': 'MERGE', 'X-RequestDigest': '0xRSPFXLOCALPREVIEW' },
        body: JSON.stringify({ Title: 'Renamed' })
      })
    );
    expect(merged.statusCode).toBe(204);
    expect(merged.body).toBe('');
    expect(merged.headers['Content-Type']).toBeUndefined();

    const after = await call(api, makeReq({ url: "/_api/web/lists/getbytitle('Announcements')/items(1)" }));
    expect(json(after)).toMatchObject({ Id: 1, Title: 'Renamed', Body: 'Local preview running without SharePoint.' });

    const replaced = await call(
      api,
      makeReq({
        url: "/_api/web/lists/getbytitle('Announcements')/items(1)",
        method: 'POST',
        headers: { 'X-HTTP-Method': 'PUT', 'X-RequestDigest': '0xRSPFXLOCALPREVIEW' },
        body: JSON.stringify({ Title: 'Replaced' })
      })
    );
    expect(replaced.statusCode).toBe(204);
    expect((json(await call(api, makeReq({ url: "/_api/web/lists/getbytitle('Announcements')/items(1)" }))) as { Title: string }).Title).toBe('Replaced');

    const deleted = await call(
      api,
      makeReq({
        url: "/_api/web/lists/getbytitle('Announcements')/items(1)",
        method: 'POST',
        headers: { 'X-HTTP-Method': 'DELETE', 'X-RequestDigest': '0xRSPFXLOCALPREVIEW' }
      })
    );
    expect(deleted.statusCode).toBe(204);

    const missing = await call(api, makeReq({ url: "/_api/web/lists/getbytitle('Announcements')/items(1)" }));
    expect(missing.statusCode).toBe(404);
  });

  it('rejects X-HTTP-Method tunneling without valid X-RequestDigest', async () => {
    const noDigest = await call(
      api,
      makeReq({
        url: "/_api/web/lists/getbytitle('Announcements')/items(1)",
        method: 'POST',
        headers: { 'X-HTTP-Method': 'MERGE' },
        body: JSON.stringify({ Title: 'Hacked' })
      })
    );
    expect(noDigest.statusCode).toBe(403);

    const badDigest = await call(
      api,
      makeReq({
        url: "/_api/web/lists/getbytitle('Announcements')/items(1)",
        method: 'POST',
        headers: { 'X-HTTP-Method': 'DELETE', 'X-RequestDigest': '0xBAD' },
        body: JSON.stringify({})
      })
    );
    expect(badDigest.statusCode).toBe(403);
  });

  it('enforces CORS allowlist and Vary header', async () => {
    const allowed = await call(api, makeReq({ url: '/_api/web', headers: { origin: 'http://localhost:4321' } }));
    expect(allowed.headers['Access-Control-Allow-Origin']).toBe('http://localhost:4321');
    expect(allowed.headers['Vary']).toBe('Origin');

    const sharepoint = await call(api, makeReq({ url: '/_api/web', headers: { origin: 'https://contoso.sharepoint.com' } }));
    expect(sharepoint.headers['Access-Control-Allow-Origin']).toBe('https://contoso.sharepoint.com');

    const blocked = await call(api, makeReq({ url: '/_api/web', headers: { origin: 'https://evil.com' } }));
    expect(blocked.headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(blocked.headers['Vary']).toBe('Origin');

    const noOrigin = await call(api, makeReq({ url: '/_api/web' }));
    expect(noOrigin.headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(noOrigin.headers['Vary']).toBe('Origin');
  });

  it('serves contextinfo with SupportedSchemaVersions and no d envelope', async () => {
    const res = await call(api, makeReq({ url: '/_api/contextinfo', method: 'POST' }));
    const data = json(res) as { d?: unknown; GetContextWebInformation: Record<string, unknown> };
    expect(data.d).toBeUndefined();
    expect(data.GetContextWebInformation.FormDigestValue).toContain('0x');
    expect(data.GetContextWebInformation.FormDigestTimeoutSeconds).toBe(1800);
    expect(data.GetContextWebInformation.SupportedSchemaVersions).toEqual(['14.0.0.0', '15.0.0.0']);
    expect(data.GetContextWebInformation.SupportedServiceVersions).toBeUndefined();
  });

  it('serves the current user with the OData v4 shape', async () => {
    const res = await call(api, makeReq({ url: '/_api/web/currentuser' }));
    const data = json(res) as {
      d?: unknown;
      Title: string;
      LoginName: string;
      Email: string;
      IsSiteAdmin: boolean;
      UserId: { NameId: string; NameIdIssuer: string };
    };
    expect(data.d).toBeUndefined();
    expect(data.LoginName).toContain('dev@contoso.onmicrosoft.com');
    expect(data.Title).toBe('Dev User');
    expect(data.IsSiteAdmin).toBe(true);
    expect(data.UserId.NameId).toBe('dev@contoso.onmicrosoft.com');
    expect(data.UserId.NameIdIssuer).toBe('urn:federation:microsoftonline');
  });

  it('sets the SP-style response headers', async () => {
    const res = await call(api, makeReq({ url: '/_api/web' }));
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toContain('odata.metadata=minimal');
    expect(res.headers['SPRequestGuid']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(res.headers['X-RequestDigest']).toBe('0xRSPFXLOCALPREVIEW');
    expect(res.headers['SPClientServiceRequestDuration']).toMatch(/^\d+$/);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('honors $top and $select on item collections', async () => {
    const res = await call(
      api,
      makeReq({ url: "/_api/web/lists/getbytitle('Announcements')/items?$top=1&$select=Title" })
    );
    const data = json(res) as { value: Record<string, unknown>[] };
    expect(data.value).toHaveLength(1);
    expect(data.value[0]).toEqual({ Title: 'Welcome to RSPFx' });
  });

  it('honors $orderby on item collections', async () => {
    const res = await call(
      api,
      makeReq({ url: "/_api/web/lists/getbytitle('Announcements')/items?$orderby=Title%20desc" })
    );
    const data = json(res) as { value: { Title: string }[] };
    expect(data.value.map((item) => item.Title)).toEqual(['Welcome to RSPFx', 'Mock list data']);
  });

  it('returns an SP-style error envelope for unknown endpoints', async () => {
    const res = await call(api, makeReq({ url: '/_api/web/search' }));
    expect(res.statusCode).toBe(400);
    expect(json(res)).toEqual({
      error: {
        code: '-1, System.NotSupportedException',
        message: { lang: 'en-US', value: expect.stringContaining('does not implement') }
      }
    });
  });
});
