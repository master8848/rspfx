export enum EnvironmentType {
  Local = 0,
  ClassicSharePoint = 1,
  SharePoint = 2
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
}
