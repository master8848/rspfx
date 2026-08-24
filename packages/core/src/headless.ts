import type { EnvironmentType } from './environment.js';
import type { ISpfxTheme, ThemeProvider } from './context.js';
import type { ComponentId, CultureName } from './newtypes.js';

export interface HeadlessAdapter<TProps extends Record<string, unknown> = Record<string, unknown>> {
  readonly mount: (root: HTMLElement, props: TProps) => void;
  readonly update: (root: HTMLElement, props: TProps) => void;
  readonly unmount: (root: HTMLElement) => void;
}

export interface HeadlessContext {
  readonly domElement: HTMLElement;
  readonly theme: ISpfxTheme | undefined;
  readonly themeProvider?: ThemeProvider;
  readonly environment: EnvironmentType;
  readonly cultureName: CultureName | string;
  readonly manifestId?: ComponentId;
}

export type PropsSelector<TProps extends Record<string, unknown> = Record<string, unknown>, TRaw = Record<string, unknown>> = (
  raw: TRaw,
  ctx: HeadlessContext,
) => TProps;

export interface HeadlessWebPartOptions<TProps extends Record<string, unknown>> {
  readonly adapter: HeadlessAdapter<TProps>;
  readonly selector?: PropsSelector<TProps>;
  readonly displayName?: string;
}
