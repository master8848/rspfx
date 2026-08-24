let warned = false;

function warnOnce(): void {
  if (warned) return;
  if (process.env.RSPFX_LOG_LEVEL === 'silent') return;
  warned = true;
  console.warn('deprecated: use @mbsks/rspfx-webpart-base');
}

warnOnce();

export { HeadlessWebPart, BaseWebPart } from '@mbsks/rspfx-webpart-base';
export type { HeadlessAdapter } from './headless.js';
