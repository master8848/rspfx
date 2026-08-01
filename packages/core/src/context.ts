import type { EnvironmentType } from './environment.js';

export interface ISpfxTheme {
  palette: Record<string, string>;
  [key: string]: unknown;
}

export interface ThemeProvider {
  getTheme(): ISpfxTheme | undefined;
  addChangeListener(listener: () => void): void;
  removeChangeListener(listener: () => void): void;
}

export interface WebPartContextLike {
  instanceId: string;
  webPartTag: string;
  domElement: HTMLElement;
  properties: Record<string, unknown>;
  environment: { type: EnvironmentType };
  pageContext: {
    web: { title: string; absoluteUrl: string };
    site: { absoluteUrl: string };
  };
  themeProvider?: ThemeProvider;
  propertyPane: Record<string, unknown>;
  [key: string]: unknown;
}
