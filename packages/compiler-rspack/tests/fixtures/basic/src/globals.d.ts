declare module '@microsoft/sp-core-library' {
  export class Version {
    constructor(major: number, minor: number, patch: number, build?: number);
    static parse(versionString: string): Version;
    static tryParse(versionString: string): Version | undefined;
    static compare(v1: string, v2: string): number;
    readonly major: number;
    readonly minor: number;
    readonly patch: number;
    readonly build: number;
    toString(): string;
    compareTo(other: Version): number;
  }
}

declare module '*.scss' {
  const classes: Record<string, string>;
  export default classes;
}
