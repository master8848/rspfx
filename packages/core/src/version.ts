export class Version {
  private readonly _major: number;
  private readonly _minor: number;
  private readonly _patch: number | undefined;
  private readonly _build: number | undefined;

  public constructor(major: number, minor: number, patch: number, build?: number) {
    this._major = major;
    this._minor = minor;
    this._patch = patch;
    this._build = build;
  }

  public static parse(versionString: string): Version {
    const version = Version.tryParse(versionString);
    if (version) {
      return version;
    }
    throw new Error(`Invalid version string: '${versionString}'`);
  }

  public static tryParse(versionString: string): Version | undefined {
    if (!versionString) {
      return undefined;
    }
    const match = /^([0-9]+)\.([0-9]+)(?:\.([0-9]+)(?:\.([0-9]+))?)?$/.exec(versionString);
    if (!match) {
      return undefined;
    }
    const patch = match[3] !== undefined ? parseInt(match[3] as string, 10) : undefined;
    const build = match[4] !== undefined ? parseInt(match[4] as string, 10) : undefined;
    return new Version(
      parseInt(match[1] as string, 10),
      parseInt(match[2] as string, 10),
      patch as number,
      build
    );
  }

  public static compare(v1: string, v2: string): number {
    const a = Version.tryParse(v1);
    const b = Version.tryParse(v2);
    if (!a || !b) {
      throw new Error(`Cannot compare invalid version strings: '${v1}' vs '${v2}'`);
    }
    if (a.major !== b.major) {
      return a.major > b.major ? 1 : -1;
    }
    if (a.minor !== b.minor) {
      return a.minor > b.minor ? 1 : -1;
    }
    if (a.patch !== b.patch) {
      return a.patch > b.patch ? 1 : -1;
    }
    if (a.build !== b.build) {
      return a.build > b.build ? 1 : -1;
    }
    return 0;
  }

  public get major(): number {
    return this._major;
  }

  public get minor(): number {
    return this._minor;
  }

  public get patch(): number {
    return this._patch ?? 0;
  }

  public get build(): number {
    return this._build ?? 0;
  }

  public toString(): string {
    let result = `${this.major}.${this.minor}`;
    if (this._patch !== undefined) {
      result += `.${this._patch}`;
      if (this._build !== undefined) {
        result += `.${this._build}`;
      }
    }
    return result;
  }

  public compareTo(other: Version): number {
    return Version.compare(this.toString(), other.toString());
  }
}
