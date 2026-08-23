import type { FrameworkId, SpfxTarget } from '@mbsks/rspfx-core';
import type { ExtensionType, ComponentType } from './component-types.js';

export interface TemplateVars {
  name: string;
  namePascal: string;
  nameCamel: string;
  componentType: ComponentType;
  framework: FrameworkId;
  spfxVersion: SpfxTarget;
  language: 'typescript' | 'javascript';
  tenantUrl?: string;
  componentId: string;
  solutionId: string;
  featureId: string;
  packageName: string;
  packageVersion: string;
  /** When false, skip teams/manifest.json scaffold; defaults to true for backward compat. */
  teams?: boolean;
  bundler?: 'vite' | 'rsbuild' | 'rspack';
}
