export interface TodoItem {
  Id: number;
  Title: string;
  Completed: boolean;
}

export interface TodoService {
  ensureList(): Promise<void>;
  getItems(): Promise<TodoItem[]>;
  addItem(title: string): Promise<void>;
  setCompleted(id: number, completed: boolean): Promise<void>;
  deleteItem(id: number): Promise<void>;
}

export interface IHttpResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export interface ISpHttpClientLike {
  configurations: { v1: unknown };
  get(url: string, config: unknown, options?: { headers?: Record<string, string> }): Promise<IHttpResponseLike>;
  post(
    url: string,
    config: unknown,
    options?: { headers?: Record<string, string>; body?: string }
  ): Promise<IHttpResponseLike>;
}

const LIST_TITLE = 'Todos';
const VERBOSE = 'application/json;odata=verbose';
const NOMETA = 'application/json;odata=nometadata';

export class SharePointTodoService implements TodoService {
  constructor(
    private readonly client: ISpHttpClientLike,
    private readonly webUrl: string
  ) {}

  private listUrl(): string {
    return `${this.webUrl}/_api/web/lists/getByTitle('${LIST_TITLE}')`;
  }

  async ensureList(): Promise<void> {
    if (!(await this.listExists())) {
      const response = await this.client.post(`${this.webUrl}/_api/web/lists`, this.client.configurations.v1, {
        headers: { Accept: VERBOSE, 'Content-Type': VERBOSE },
        body: JSON.stringify({
          __metadata: { type: 'SP.List' },
          Title: LIST_TITLE,
          BaseTemplate: 100,
          Description: 'Simple Solid.js todo list'
        })
      });
      if (!response.ok) {
        throw new Error(`Failed to create the "${LIST_TITLE}" list: HTTP ${response.status}`);
      }
    }
    await this.ensureCompletedField();
  }

  private async listExists(): Promise<boolean> {
    const response = await this.client.get(this.listUrl(), this.client.configurations.v1);
    return response.ok;
  }

  private async ensureCompletedField(): Promise<void> {
    const check = await this.client.get(
      `${this.listUrl()}/fields/getByInternalNameOrTitle('Completed')`,
      this.client.configurations.v1
    );
    if (check.ok) {
      return;
    }
    const response = await this.client.post(`${this.listUrl()}/fields`, this.client.configurations.v1, {
      headers: { Accept: VERBOSE, 'Content-Type': VERBOSE },
      body: JSON.stringify({ __metadata: { type: 'SP.Field' }, Title: 'Completed', FieldTypeKind: 8 })
    });
    if (!response.ok) {
      throw new Error(`Failed to create the "Completed" field: HTTP ${response.status}`);
    }
  }

  async getItems(): Promise<TodoItem[]> {
    const response = await this.client.get(
      `${this.listUrl()}/items?$select=Id,Title,Completed&$orderby=Id%20desc`,
      this.client.configurations.v1,
      { headers: { Accept: NOMETA } }
    );
    if (!response.ok) {
      throw new Error(`Failed to load todos: HTTP ${response.status}`);
    }
    const data = (await response.json()) as { value?: TodoItem[] };
    return data.value ?? [];
  }

  async addItem(title: string): Promise<void> {
    const response = await this.client.post(`${this.listUrl()}/items`, this.client.configurations.v1, {
      headers: { Accept: NOMETA, 'Content-Type': NOMETA },
      body: JSON.stringify({ Title: title, Completed: false })
    });
    if (!response.ok) {
      throw new Error(`Failed to add todo: HTTP ${response.status}`);
    }
  }

  async setCompleted(id: number, completed: boolean): Promise<void> {
    const response = await this.client.post(`${this.listUrl()}/items(${id})`, this.client.configurations.v1, {
      headers: { Accept: NOMETA, 'Content-Type': NOMETA, 'X-HTTP-Method': 'MERGE', 'If-Match': '*' },
      body: JSON.stringify({ Completed: completed })
    });
    if (!response.ok) {
      throw new Error(`Failed to update todo: HTTP ${response.status}`);
    }
  }

  async deleteItem(id: number): Promise<void> {
    const response = await this.client.post(`${this.listUrl()}/items(${id})`, this.client.configurations.v1, {
      headers: { Accept: NOMETA, 'X-HTTP-Method': 'DELETE', 'If-Match': '*' }
    });
    if (!response.ok) {
      throw new Error(`Failed to delete todo: HTTP ${response.status}`);
    }
  }
}

const DEMO_STORAGE_KEY = 'rspfx-solid-todo';

export class LocalTodoService implements TodoService {
  private read(): TodoItem[] {
    try {
      const raw = localStorage.getItem(DEMO_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as TodoItem[]) : [];
    } catch {
      return [];
    }
  }

  private write(items: TodoItem[]): void {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(items));
  }

  async ensureList(): Promise<void> {}

  async getItems(): Promise<TodoItem[]> {
    return this.read().slice().reverse();
  }

  async addItem(title: string): Promise<void> {
    const items = this.read();
    items.push({ Id: Date.now(), Title: title, Completed: false });
    this.write(items);
  }

  async setCompleted(id: number, completed: boolean): Promise<void> {
    this.write(this.read().map((item) => (item.Id === id ? { ...item, Completed: completed } : item)));
  }

  async deleteItem(id: number): Promise<void> {
    this.write(this.read().filter((item) => item.Id !== id));
  }
}
