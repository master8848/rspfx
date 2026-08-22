export enum EnvironmentType {
  Test = 0,
  Local = 1,
  SharePoint = 2,
  ClassicSharePoint = 3
}

export enum DisplayMode {
  Read = 1,
  Edit = 2
}

export class Environment {
  private static _type: EnvironmentType = EnvironmentType.Test;
  static get type(): EnvironmentType {
    return Environment._type;
  }
  static _initialize(data: { type: EnvironmentType }): void {
    Environment._type = data.type;
  }
}

export class Version {
  constructor(
    public readonly major: number,
    public readonly minor: number,
    public readonly patch: number,
    public readonly build: number = 0
  ) {}

  public static parse(versionString: string): Version {
    const v = Version.tryParse(versionString);
    if (!v) {
      throw new Error(`Invalid version string: '${versionString}'`);
    }
    return v;
  }

  public static tryParse(versionString: string): Version | undefined {
    const parts = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?$/.exec(versionString.trim());
    if (!parts) {
      return undefined;
    }
    return new Version(
      Number(parts[1]),
      parts[2] ? Number(parts[2]) : 0,
      parts[3] ? Number(parts[3]) : 0,
      parts[4] ? Number(parts[4]) : 0
    );
  }

  public static compare(v1: string, v2: string): number {
    return Version.parse(v1).compareTo(Version.parse(v2));
  }

  public compareTo(other: Version): number {
    if (this.major !== other.major) return this.major > other.major ? 1 : -1;
    if (this.minor !== other.minor) return this.minor > other.minor ? 1 : -1;
    if (this.patch !== other.patch) return this.patch > other.patch ? 1 : -1;
    if (this.build !== other.build) return this.build > other.build ? 1 : -1;
    return 0;
  }

  public toString(): string {
    return `${this.major}.${this.minor}.${this.patch}.${this.build}`;
  }
}

export class ServiceScope {
  public static startNewRoot(): ServiceScope {
    return new ServiceScope();
  }
  public createAndProvide<T>(key: unknown, factory: unknown): T {
    return undefined as unknown as T;
  }
  public provide<T>(key: unknown, service: T): T {
    return service;
  }
  public consume<T>(key: unknown): T {
    return undefined as unknown as T;
  }
  public finish(): void {}
  public whenFinished(callback: () => void): void {
    callback();
  }
  public startNewChild(): ServiceScope {
    return new ServiceScope();
  }
}

// Minimal Guid mock mirroring @microsoft/sp-core-library 1.23.2
export class Guid {
  static readonly empty: Guid = new (Guid as unknown as { new (g: string): Guid })('00000000-0000-0000-0000-000000000000');
  private _guid: string;
  private constructor(guid: string) {
    this._guid = guid.toLowerCase();
  }
  static newGuid(): Guid {
    const s = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    return new (Guid as unknown as { new (g: string): Guid })(s);
  }
  static parse(guidString: string | undefined | null): Guid {
    const g = Guid.tryParse(guidString);
    if (!g) throw new Error(`Invalid GUID: ${guidString}`);
    return g;
  }
  static tryParse(guid: string | undefined | null): Guid | undefined {
    if (!guid) return undefined;
    const n = Guid._normalize(guid);
    if (!Guid.isValid(n)) return undefined;
    return new (Guid as unknown as { new (g: string): Guid })(n);
  }
  static isValid(guid: string | undefined | null): boolean {
    if (!guid) return false;
    const n = Guid._normalize(guid);
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(n);
  }
  private static _normalize(guid: string): string {
    let s = guid.trim().toLowerCase();
    if (s.startsWith('/guid(') && s.endsWith(')/')) s = s.slice(6, -2);
    else if (s.startsWith('guid(') && s.endsWith(')')) s = s.slice(5, -1);
    if (s.startsWith('{') && s.endsWith('}')) s = s.slice(1, -1);
    return s;
  }
  equals(guid: Guid): boolean {
    return this._guid === guid._guid;
  }
  toString(): string {
    return this._guid;
  }
}

// Minimal ServiceKey mock
let _serviceKeyCounter = 0;
export class ServiceKey<T> {
  readonly id: string;
  readonly name: string;
  readonly defaultCreator: (scope: unknown) => T;
  protected constructor(id: string, name: string, defaultCreator: (scope: unknown) => T) {
    this.id = id;
    this.name = name;
    this.defaultCreator = defaultCreator;
  }
  static create<TKey>(name: string, serviceClass: new (scope: unknown) => TKey): ServiceKey<TKey> {
    return new ServiceKey<TKey>(`ServiceKey_${_serviceKeyCounter++}`, name, (s) => new serviceClass(s));
  }
  static createCustom<TKey>(name: string, defaultCreator: (scope: unknown) => TKey): ServiceKey<TKey> {
    return new ServiceKey<TKey>(`ServiceKey_${_serviceKeyCounter++}`, name, defaultCreator);
  }
}

export class Log {
  static verbose(_source: string, _message: string, _scope?: unknown): void {}
  static info(_source: string, _message: string, _scope?: unknown): void {}
  static warn(_source: string, _message: string, _scope?: unknown): void {}
  static error(_source: string, _error: Error, _scope?: unknown): void {}
}

export class Validate {
  static isTrue(value: boolean | undefined | null, variableName: string): void {
    if (!value) throw new Error(`${variableName} is not true`);
  }
  static isNotNullOrUndefined(value: unknown, variableName: string): void {
    if (value === null || value === undefined) throw new Error(`${variableName} is null or undefined`);
  }
  static isNonemptyString(value: string | undefined | null, variableName: string): void {
    if (!value) throw new Error(`${variableName} is empty`);
  }
  static isNotDisposed(value: { isDisposed: boolean }, className: string): void {
    if (value.isDisposed) throw new Error(`${className} is disposed`);
  }
}

export class SPEventArgs {}

export class SPEvent<T extends SPEventArgs = SPEventArgs> {
  private _handlers: Array<{ observer: unknown; handler: (args: T) => void }> = [];
  add(observer: unknown, handler: (args: T) => void): void {
    this._handlers.push({ observer, handler });
  }
  remove(observer: unknown, handler: (args: T) => void): void {
    this._handlers = this._handlers.filter((h) => h.observer !== observer || h.handler !== handler);
  }
  // test helper to raise
  _raise(args: T): void {
    for (const h of this._handlers) h.handler(args);
  }
}
