/**
 * In-browser emulation of the `@microsoft/sp-http` data clients for the local
 * preview. The SPHttpClient mock talks to the same-origin `/_api/` endpoints
 * served by the rspfx dev server (mock list/user data); the MSGraphClient mock
 * and the AAD client mock answer from fixed local data. Responses duck-type
 * the real `SPHttpClientResponse` surface (ok/status/statusText/headers/
 * json/text/clone) — here they are native `Response` objects.
 */

export type MockTransport = (url: string, init?: RequestInit) => Promise<Response>;

export const defaultMockTransport: MockTransport = (url, init) => fetch(url, init);

export interface MockSpHttpClient {
  get(
    configuration: unknown,
    url: string,
    options?: Record<string, unknown>
  ): Promise<Response>;
  post(
    configuration: unknown,
    url: string,
    options?: Record<string, unknown>
  ): Promise<Response>;
  fetch(configuration: unknown, url: string, options?: Record<string, unknown>): Promise<Response>;
}

function normalizeBody(options?: Record<string, unknown>): BodyInit | undefined {
  if (!options) {
    return undefined;
  }
  const body = options.body as BodyInit | undefined;
  if (body !== undefined) {
    return body;
  }
  const form = options.form as Record<string, string> | undefined;
  if (form) {
    return new URLSearchParams(form).toString();
  }
  return undefined;
}

function requestInit(method: string, options?: Record<string, unknown>): RequestInit {
  const init: RequestInit = { method };
  const body = normalizeBody(options);
  if (body !== undefined) {
    init.body = body;
  }
  const headers: Record<string, string> = {
    Accept: 'application/json;odata.metadata=minimal',
    'OData-Version': '4.0',
    ...((options?.headers as Record<string, string>) ?? {})
  };
  if (body !== undefined && typeof body === 'string') {
    headers['Content-Type'] = 'application/json;odata.metadata=minimal';
  }
  init.headers = headers;
  return init;
}

export function createMockSPHttpClient(transport: MockTransport = defaultMockTransport): MockSpHttpClient {
  const request = (
    configuration: unknown,
    url: string,
    options?: Record<string, unknown>
  ): Promise<Response> => transport(url, requestInit('GET', options));

  return {
    get: request,
    post: (configuration, url, options) => transport(url, requestInit('POST', options)),
    fetch: request
  };
}

export interface MockAadHttpClient {
  get(url: string, options?: Record<string, unknown>): Promise<Response>;
  post(url: string, options?: Record<string, unknown>): Promise<Response>;
  fetch(url: string, options?: Record<string, unknown>): Promise<Response>;
}

export function createMockAadHttpClientFactory(transport: MockTransport = defaultMockTransport): {
  getClient(resourceUrl: string): Promise<MockAadHttpClient>;
} {
  const client: MockAadHttpClient = {
    get: (url, options) =>
      transport(url, {
        ...requestInit('GET', options),
        headers: { ...requestInit('GET', options).headers, Authorization: 'Bearer rspfx-local-mock-token' }
      }),
    post: (url, options) =>
      transport(url, {
        ...requestInit('POST', options),
        headers: { ...requestInit('POST', options).headers, Authorization: 'Bearer rspfx-local-mock-token' }
      }),
    fetch: (url, options) =>
      transport(url, {
        ...requestInit('GET', options),
        headers: { ...requestInit('GET', options).headers, Authorization: 'Bearer rspfx-local-mock-token' }
      })
  };
  return {
    getClient: async () => client
  };
}

export interface MockGraphData {
  [path: string]: unknown;
}

export const LOCAL_GRAPH_DATA: MockGraphData = {
  '/v1.0/me': {
    id: 'dev@contoso.onmicrosoft.com',
    displayName: 'Dev User',
    givenName: 'Dev',
    surname: 'User',
    mail: 'dev@contoso.onmicrosoft.com',
    userPrincipalName: 'dev@contoso.onmicrosoft.com',
    jobTitle: 'Developer',
    officeLocation: 'Local',
    preferredLanguage: 'en-US'
  },
  '/v1.0/me/drive/root': {
    id: 'root',
    name: 'root',
    webUrl: 'http://localhost/_local/drive/root',
    folder: { childCount: 2 }
  },
  '/v1.0/me/drive/root/children': {
    value: [
      {
        id: 'file-1',
        name: 'README.md',
        size: 1024,
        file: { mimeType: 'text/markdown' },
        webUrl: 'http://localhost/_local/drive/README.md'
      },
      {
        id: 'folder-1',
        name: 'Documents',
        size: 0,
        folder: { childCount: 0 },
        webUrl: 'http://localhost/_local/drive/Documents'
      }
    ]
  },
  '/v1.0/users': {
    value: [
      {
        id: 'dev@contoso.onmicrosoft.com',
        displayName: 'Dev User',
        mail: 'dev@contoso.onmicrosoft.com',
        userPrincipalName: 'dev@contoso.onmicrosoft.com'
      },
      {
        id: 'owner@contoso.onmicrosoft.com',
        displayName: 'Site Owner',
        mail: 'owner@contoso.onmicrosoft.com',
        userPrincipalName: 'owner@contoso.onmicrosoft.com'
      }
    ]
  },
  '/v1.0/me/memberOf': {
    value: [
      {
        id: 'group-site-members',
        displayName: 'Site Members',
        mailEnabled: false,
        securityEnabled: true
      }
    ]
  }
};

export interface MockMSGraphClientRequest {
  version(_version: string): MockMSGraphClientRequest;
  select(_select: string | string[]): MockMSGraphClientRequest;
  filter(_filter: string): MockMSGraphClientRequest;
  top(_top: number): MockMSGraphClientRequest;
  expand(_expand: string | string[]): MockMSGraphClientRequest;
  orderby(_orderby: string | string[]): MockMSGraphClientRequest;
  skip(_skip: number): MockMSGraphClientRequest;
  skipToken(_skipToken: string): MockMSGraphClientRequest;
  count(_count?: boolean): MockMSGraphClientRequest;
  query(_query: Record<string, string>): MockMSGraphClientRequest;
  responseType(_responseType: string): MockMSGraphClientRequest;
  header(_name: string, _value: string): MockMSGraphClientRequest;
  headers(_headers: Record<string, string>): MockMSGraphClientRequest;
  get(): Promise<unknown>;
  post(_body?: unknown): Promise<unknown>;
  patch(_body?: unknown): Promise<unknown>;
  put(_body?: unknown): Promise<unknown>;
  delete(): Promise<unknown>;
  del(_url?: string): Promise<unknown>;
  update(_body?: unknown): Promise<unknown>;
  create(_body?: unknown): Promise<unknown>;
  requestHeaders?: Record<string, string>;
  requestResponseType?: string;
}

export interface MockMSGraphClient {
  api(path: string): MockMSGraphClientRequest;
  lastRequestPath?: string;
  lastRequestMethod?: string;
}

export function createMockMSGraphClientFactory(data: MockGraphData = LOCAL_GRAPH_DATA): {
  getClient(_version?: '1' | '3'): Promise<MockMSGraphClient>;
} {
  const resolve = (path: string): unknown => {
    const normalized = path.split('?')[0]!.replace(/\/+$/, '') || '/';
    return data[normalized];
  };
  const fail = (path: string): { error: { code: string; message: string } } => ({
    error: { code: 'BadRequest', message: `RSPFx local mock: unknown Graph endpoint "${path}"` }
  });

  const client: MockMSGraphClient = {
    api(path) {
      let requestPath = path;
      const queryParams: Record<string, string> = {};
      const customParams: Record<string, string> = {};
      let requestHeaders: Record<string, string> = {};
      const join = (values: string | string[]): string =>
        Array.isArray(values) ? values.join(',') : values;
      const buildPath = (): string => {
        const ordered = ['$select', '$expand', '$orderby', '$top', '$skip', '$count', '$filter', '$skiptoken'];
        const parts: string[] = [];
        for (const key of ordered) {
          const value = queryParams[key];
          if (value !== undefined) {
            parts.push(`${key}=${value}`);
          }
        }
        for (const [key, value] of Object.entries(customParams)) {
          parts.push(`${key}=${value}`);
        }
        return parts.length > 0 ? `${requestPath}?${parts.join('&')}` : requestPath;
      };
      const request = (method: string, body?: unknown): Promise<unknown> => {
        const builtPath = buildPath();
        client.lastRequestPath = builtPath;
        client.lastRequestMethod = method;
        const found = resolve(builtPath);
        if (found !== undefined) {
          return Promise.resolve(method === 'DELETE' ? undefined : found);
        }
        return Promise.resolve(fail(builtPath));
      };
      const self: MockMSGraphClientRequest = {
        version: (_version) => {
          requestPath = `/${_version}${requestPath}`;
          return self;
        },
        select: (_select) => {
          queryParams['$select'] = join(_select);
          return self;
        },
        filter: (_filter) => {
          queryParams['$filter'] = _filter;
          return self;
        },
        top: (_top) => {
          queryParams['$top'] = String(_top);
          return self;
        },
        expand: (_expand) => {
          queryParams['$expand'] = join(_expand);
          return self;
        },
        orderby: (_orderby) => {
          queryParams['$orderby'] = join(_orderby);
          return self;
        },
        skip: (_skip) => {
          queryParams['$skip'] = String(_skip);
          return self;
        },
        skipToken: (_skipToken) => {
          queryParams['$skiptoken'] = _skipToken;
          return self;
        },
        count: (_count) => {
          queryParams['$count'] = String(_count ?? true);
          return self;
        },
        query: (_query) => {
          for (const [key, value] of Object.entries(_query)) {
            customParams[key] = value;
          }
          return self;
        },
        responseType: (_responseType) => {
          self.requestResponseType = _responseType;
          return self;
        },
        header: (_name, _value) => {
          requestHeaders[_name] = _value;
          self.requestHeaders = requestHeaders;
          return self;
        },
        headers: (_headers) => {
          requestHeaders = { ...requestHeaders, ..._headers };
          self.requestHeaders = requestHeaders;
          return self;
        },
        get: () => request('GET'),
        post: (_body) => request('POST', _body),
        patch: (_body) => request('PATCH', _body),
        put: (_body) => request('PUT', _body),
        delete: () => request('DELETE'),
        del: () => request('DELETE'),
        update: (_body) => request('PATCH', _body),
        create: (_body) => request('POST', _body)
      };
      return self;
    }
  };

  return {
    getClient: async (_version) => client
  };
}
