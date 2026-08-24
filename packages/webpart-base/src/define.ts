import { HeadlessWebPart, type HeadlessAdapter } from './index.js';

export interface DefineWebPartOptions<TProps extends Record<string, unknown>> {
  readonly adapterFactory: (host: { domElement: HTMLElement }) => HeadlessAdapter<TProps>;
  readonly selector?: (raw: Record<string, unknown>, ctx: unknown) => TProps;
  readonly propertiesSchema?: (raw: unknown) => TProps;
  readonly displayName?: string;
  readonly getPropertyPaneConfiguration?: () => unknown;
}

export function defineWebPart<const TProps extends Record<string, unknown>>(
  opts: DefineWebPartOptions<TProps>,
): new () => HeadlessWebPart<TProps> {
  const Cls = class extends HeadlessWebPart<TProps> {
    protected createAdapter(): HeadlessAdapter<TProps> {
      return opts.adapterFactory({ domElement: this.domElement });
    }

    protected override getComponentProps(): TProps {
      const raw = super.getComponentProps();
      if (opts.propertiesSchema) {
        return opts.propertiesSchema(raw);
      }
      if (opts.selector) {
        const ctx = {
          domElement: this.domElement,
          theme: undefined,
          themeProvider: undefined,
          environment: 0,
          cultureName: 'en-US',
        };
        return opts.selector(raw as unknown as Record<string, unknown>, ctx as unknown) as TProps;
      }
      return raw;
    }

    protected override getPropertyPaneConfiguration(): any {
      if (opts.getPropertyPaneConfiguration) {
        return opts.getPropertyPaneConfiguration() as any;
      }
      return { pages: [] } as any;
    }
  } as unknown as { getPropertyPaneConfiguration(): any } & typeof HeadlessWebPart<TProps>;
  if (opts.displayName) {
    Object.defineProperty(Cls, 'name', { value: opts.displayName });
  }
  return Cls as unknown as new () => HeadlessWebPart<TProps>;
}
