import type { RspfxConfig } from '@mbsks/rspfx-core';

export interface RspfxPluginOptions extends Partial<Omit<RspfxConfig, 'name'>> {
  name: string;
  projectRoot?: string;
}
