import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Mock SharePoint REST API for local preview mode. Serves the `/_api/` subset
 * web parts commonly hit through `SPHttpClient`: context info, current user,
 * web/site info, list metadata and list item CRUD. Responses use OData v4
 * JSON light (minimal metadata) matching `SPHttpClient.configurations.v1`:
 * collections as `{ value: [...] }` and no `d` envelope.
 *
 * The store is seeded from defaults and optionally from `local/data.json`
 * (`{ lists: [...], currentUser: {...}, web: {...} }`) in the project root.
 */

export interface MockApiResponse {
  setHeader(name: string, value: string): void;
  end(body?: string): void;
  statusCode?: number;
}

export interface MockApiRequest {
  url?: string;
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  on?(event: 'data' | 'end', callback: (chunk?: unknown) => void): void;
}

export interface MockApiOptions {
  projectRoot: string;
  /** Current dev server origin (http://localhost:<port>) used for web/site Urls. */
  origin: () => string;
}

export interface MockListItem {
  Id: number;
  Title: string;
  [key: string]: unknown;
}

export interface MockList {
  Id: string;
  Title: string;
  BaseTemplate: number;
  ServerRelativeUrl: string;
  Created: string;
  LastItemModifiedDate: string;
  ItemCount: number;
  items: MockListItem[];
}

export interface MockStore {
  lists: MockList[];
  currentUser: Record<string, unknown>;
  web: Record<string, unknown>;
  site: Record<string, unknown>;
}

const WEB_ID = '3d81f5a1-0000-0000-0000-000000000001';
const SITE_ID = '3d81f5a1-0000-0000-0000-000000000002';
const DIGEST = '0xRSPFXLOCALPREVIEW';
const ITEM_CONTENT_TYPE_ID = '0x010100C568DB52D9D0A14D9B2FDCC96666E9F2';

const DEFAULT_CURRENT_USER = {
  Id: 1,
  LoginName: 'i:0#.f|membership|dev@contoso.onmicrosoft.com',
  Title: 'Dev User',
  Email: 'dev@contoso.onmicrosoft.com',
  UserPrincipalName: 'dev@contoso.onmicrosoft.com',
  IsSiteAdmin: true,
  IsHiddenInUI: false,
  UserId: {
    NameId: 'dev@contoso.onmicrosoft.com',
    NameIdIssuer: 'urn:federation:microsoftonline'
  }
};

function iso(offsetDays = 0): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return date.toISOString();
}

export function createDefaultMockStore(): MockStore {
  return {
    lists: [
      {
        Id: '3d81f5a1-0000-0000-0000-000000000010',
        Title: 'Announcements',
        BaseTemplate: 104,
        ServerRelativeUrl: '/Lists/Announcements',
        Created: iso(-30),
        LastItemModifiedDate: iso(-1),
        ItemCount: 2,
        items: [
          { Id: 1, Title: 'Welcome to RSPFX', Body: 'Local preview running without SharePoint.', Created: iso(-30), Modified: iso(-30), AuthorId: 1, EditorId: 1 },
          { Id: 2, Title: 'Mock list data', Body: 'Edit local/data.json in the project root to customize.', Created: iso(-15), Modified: iso(-15), AuthorId: 1, EditorId: 1 }
        ]
      },
      {
        Id: '3d81f5a1-0000-0000-0000-000000000011',
        Title: 'Documents',
        BaseTemplate: 101,
        ServerRelativeUrl: '/Documents',
        Created: iso(-30),
        LastItemModifiedDate: iso(-2),
        ItemCount: 1,
        items: [
          { Id: 1, Title: 'README.md', FileLeafRef: 'README.md', FileDirRef: '/Documents', Created: iso(-20), Modified: iso(-2), AuthorId: 1, EditorId: 1 }
        ]
      }
    ],
    currentUser: DEFAULT_CURRENT_USER,
    web: {},
    site: {}
  };
}

function loadSeed(projectRoot: string): Partial<MockStore> | undefined {
  const seedPath = path.join(projectRoot, 'local', 'data.json');
  try {
    const raw = fs.readFileSync(seedPath, 'utf8');
    return JSON.parse(raw) as Partial<MockStore>;
  } catch {
    return undefined;
  }
}

export function createMockSharePointApi(opts: MockApiOptions): {
  path: string;
  handle(req: unknown, res: MockApiResponse): void;
} {
  const store = createDefaultMockStore();
  const seed = loadSeed(opts.projectRoot);
  if (seed) {
    if (Array.isArray(seed.lists)) {
      store.lists = seed.lists as MockList[];
    }
    if (seed.currentUser) {
      store.currentUser = { ...store.currentUser, ...seed.currentUser };
    }
  }
  const origin = opts.origin;
  store.web = {
    Id: WEB_ID,
    Title: 'Local Workbench',
    Url: origin(),
    ServerRelativeUrl: '/',
    Description: '',
    Created: iso(-30),
    Modified: iso(-1),
    Language: 1033,
    WebTemplate: 'GROUP'
  };
  store.site = {
    Id: SITE_ID,
    Title: 'Local Workbench',
    Url: origin(),
    ServerRelativeUrl: '/'
  };
  for (const list of store.lists) {
    for (const item of list.items) {
      if (typeof item.GUID !== 'string') {
        item.GUID = randomUUID();
      }
    }
  }

  const respond = (res: MockApiResponse, status: number, body: unknown): void => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json;odata.metadata=minimal;charset=utf-8');
    res.setHeader('SPRequestGuid', randomUUID());
    res.setHeader('SPClientServiceRequestDuration', String(Math.floor(Math.random() * 100) + 1));
    res.setHeader('X-RequestDigest', DIGEST);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify(body));
  };

  const respondError = (res: MockApiResponse, status: number, code: string, message: string): void => {
    respond(res, status, {
      error: {
        code: `-1, ${code}`,
        message: { lang: 'en-US', value: message }
      }
    });
  };

  const listByTitle = (title: string): MockList | undefined =>
    store.lists.find((list) => list.Title.toLowerCase() === decodeURIComponent(title).toLowerCase());

  const publicList = (list: MockList): Record<string, unknown> => {
    const entityTypeName = list.Title.replace(/\s+/g, '');
    return {
      Id: list.Id,
      Title: list.Title,
      ServerRelativeUrl: list.ServerRelativeUrl,
      BaseTemplate: list.BaseTemplate,
      BaseType: 0,
      Description: '',
      EnableVersioning: false,
      EntityTypeName: entityTypeName,
      Hidden: false,
      ItemCount: list.ItemCount,
      LastItemDeletedDate: '1899-12-30T00:00:00Z',
      LastItemModifiedDate: list.LastItemModifiedDate,
      ListItemEntityTypeFullName: `SP.Data.${entityTypeName}ListItem`,
      ParentWebUrl: '/',
      Created: list.Created,
      Modified: list.LastItemModifiedDate
    };
  };

  const publicItem = (item: MockListItem): Record<string, unknown> => ({
    ...item,
    ContentTypeId: item.ContentTypeId ?? ITEM_CONTENT_TYPE_ID,
    Modified: item.Modified ?? '',
    Created: item.Created ?? '',
    AuthorId: item.AuthorId ?? 1,
    EditorId: item.EditorId ?? 1,
    OData__UIVersionString: item.OData__UIVersionString ?? '1.0',
    Attachments: item.Attachments ?? false,
    GUID: item.GUID ?? randomUUID()
  });

  const selectFields = (items: Record<string, unknown>[], select?: string): Record<string, unknown>[] => {
    if (!select) {
      return items.map((item) => ({ ...item }));
    }
    const fields = select
      .replace(/^\*/g, '')
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean);
    return items.map((item) =>
      Object.fromEntries(fields.map((field) => [field, item[field]]))
    );
  };

  const handle = async (req: unknown, res: MockApiResponse): Promise<void> => {
    const request = req as MockApiRequest;
    const url = request.url ?? '';
    const queryIndex = url.indexOf('?');
    const rawPath = queryIndex === -1 ? url : url.slice(0, queryIndex);
    const rawQuery = queryIndex === -1 ? '' : url.slice(queryIndex + 1);
    const headers = request.headers ?? {};
    const httpMethodHeader = Object.entries(headers).find(([name]) => name.toLowerCase() === 'x-http-method')?.[1];
    const override = Array.isArray(httpMethodHeader) ? httpMethodHeader[0] : httpMethodHeader;
    const method = (override ?? request.method ?? 'GET').toUpperCase();
    const path = rawPath.replace(/^\/_api/, '').replace(/\/+$/, '') || '/';
    const query = new URLSearchParams(rawQuery);
    const body = method === 'POST' || method === 'PATCH' || method === 'MERGE' || method === 'PUT' ? await readRequestBody(req) : {};

    if (method === 'POST' && path === '/contextinfo') {
      respond(res, 200, {
        GetContextWebInformation: {
          FormDigestValue: DIGEST,
          FormDigestTimeoutSeconds: 1800,
          SiteFullUrl: origin(),
          WebFullUrl: origin(),
          SupportedSchemaVersions: ['14.0.0.0', '15.0.0.0']
        }
      });
      return;
    }
    if (method === 'GET' && path === '/web') {
      respond(res, 200, store.web);
      return;
    }
    if (method === 'GET' && path === '/site') {
      respond(res, 200, store.site);
      return;
    }
    if (method === 'GET' && path === '/web/currentuser') {
      respond(res, 200, store.currentUser);
      return;
    }
    if (method === 'GET' && path === '/web/lists') {
      respond(res, 200, { value: store.lists.map(publicList) });
      return;
    }
    if (method === 'GET' && path === '/web/siteusers') {
      respond(res, 200, { value: [store.currentUser] });
      return;
    }

    const listGuidMatch = /^\/web\/lists\(guid'([^']+)'\)$/.exec(path);
    if (listGuidMatch && method === 'GET') {
      const list = store.lists.find((entry) => entry.Id.toLowerCase() === listGuidMatch[1]!.toLowerCase());
      if (!list) {
        respondError(res, 404, 'System.IO.FileNotFoundException', `List '${listGuidMatch[1]}' does not exist at site with URL '${origin()}'`);
        return;
      }
      respond(res, 200, publicList(list));
      return;
    }

    const itemMatch = /^\/web\/lists\/getbytitle\('([^']+)'\)\/items\((\d+)\)$/.exec(path);
    if (itemMatch) {
      const list = listByTitle(itemMatch[1]!);
      if (!list) {
        respondError(res, 404, 'System.IO.FileNotFoundException', `List '${itemMatch[1]}' does not exist at site with URL '${origin()}'`);
        return;
      }
      const id = Number(itemMatch[2]);
      const index = list.items.findIndex((item) => item.Id === id);
      if (method === 'GET') {
        if (index === -1) {
          respondError(res, 404, 'System.IO.FileNotFoundException', `Item with id ${id} was not found.`);
          return;
        }
        respond(res, 200, publicItem(list.items[index]!));
        return;
      }
      if (method === 'MERGE' || method === 'PATCH' || method === 'PUT') {
        if (index === -1) {
          respondError(res, 404, 'System.IO.FileNotFoundException', `Item with id ${id} was not found.`);
          return;
        }
        const existing = list.items[index]!;
        if (method === 'PUT') {
          const readOnly = { Id: existing.Id, GUID: existing.GUID, Created: existing.Created, Modified: iso() };
          list.items[index] = { ...existing, ...body, ...readOnly } as MockListItem;
        } else {
          list.items[index] = { ...existing, ...body } as MockListItem;
        }
        res.statusCode = 204;
        res.end();
        return;
      }
      if (method === 'DELETE') {
        if (index !== -1) {
          list.items.splice(index, 1);
          list.ItemCount = list.items.length;
        }
        res.statusCode = 204;
        res.end();
        return;
      }
      respondError(res, 400, 'System.NotSupportedException', `Method ${method} is not supported by the local preview mock.`);
      return;
    }

    const collectionMatch = /^\/web\/lists\/getbytitle\('([^']+)'\)\/items$/.exec(path);
    if (collectionMatch) {
      const list = listByTitle(collectionMatch[1]!);
      if (!list) {
        respondError(res, 404, 'System.IO.FileNotFoundException', `List '${collectionMatch[1]}' does not exist at site with URL '${origin()}'`);
        return;
      }
      if (method === 'GET') {
        let items = list.items.map(publicItem);
        const orderBy = query.get('$orderby');
        if (orderBy) {
          const [field = '', direction = 'asc'] = orderBy.split(/\s+/);
          const dir = direction.toLowerCase() === 'desc' ? -1 : 1;
          items.sort((a, b) => (String(a[field] ?? '') < String(b[field] ?? '') ? -dir : String(a[field] ?? '') > String(b[field] ?? '') ? dir : 0));
        }
        const top = Number(query.get('$top'));
        if (Number.isFinite(top) && top > 0) {
          items = items.slice(0, top);
        }
        const select = query.get('$select');
        respond(res, 200, { value: selectFields(items, select ?? undefined) });
        return;
      }
      if (method === 'POST') {
        const nextId = list.items.reduce((max, item) => Math.max(max, item.Id), 0) + 1;
        const item: MockListItem = {
          Title: 'New item',
          AuthorId: 1,
          EditorId: 1,
          ...body,
          Id: nextId,
          ContentTypeId: ITEM_CONTENT_TYPE_ID,
          OData__UIVersionString: '1.0',
          Attachments: false,
          GUID: randomUUID(),
          Created: iso(),
          Modified: iso()
        };
        list.items.push(item);
        list.ItemCount = list.items.length;
        respond(res, 201, publicItem(item));
        return;
      }
      respondError(res, 400, 'System.NotSupportedException', `Method ${method} is not supported by the local preview mock.`);
      return;
    }

    const listMatch = /^\/web\/lists\/getbytitle\('([^']+)'\)$/.exec(path);
    if (listMatch && method === 'GET') {
      const list = listByTitle(listMatch[1]!);
      if (!list) {
        respondError(res, 404, 'System.IO.FileNotFoundException', `List '${listMatch[1]}' does not exist at site with URL '${origin()}'`);
        return;
      }
      respond(res, 200, publicList(list));
      return;
    }

    respondError(res, 400, 'System.NotSupportedException', `The local preview mock does not implement ${method} ${rawPath}. See docs/commands.md (rspfx dev --mode local) for the supported /_api/ endpoints.`);
  };

  return { path: '/_api', handle };
}

async function readRequestBody(req: unknown): Promise<Record<string, unknown>> {
  const request = req as MockApiRequest;
  if (request.body !== undefined) {
    if (typeof request.body === 'string') {
      try {
        return JSON.parse(request.body) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return request.body as Record<string, unknown>;
  }
  if (typeof request.on === 'function') {
    const chunks: Buffer[] = [];
    const on = request.on.bind(request);
    await new Promise<void>((resolve) => {
      on('data', (chunk) => {
        chunks.push(Buffer.from(chunk as Buffer));
      });
      on('end', () => resolve());
    });
    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw) {
      return {};
    }
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}
