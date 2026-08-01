import { h } from 'preact';
import { createMockWebPartContext } from '@mbsks/rspfx-sharepoint-runtime';
import { adapter } from '@mbsks/rspfx-framework-preact';
import manifest from '../src/webparts/hello/hello.manifest.json';
import Hello from '../src/webparts/hello/components/Hello';

const context = createMockWebPartContext(manifest, {
  properties: { description: 'Hello from preact' }
});

adapter.mount(
  document.getElementById('root')!,
  h(Hello, { description: String(context.properties.description) })
);
