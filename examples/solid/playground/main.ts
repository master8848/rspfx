import { createComponent } from 'solid-js';
import { createMockWebPartContext } from '@mbsks/rspfx-sharepoint-runtime';
import { adapter } from '@mbsks/rspfx-framework-solid';
import manifest from '../src/webparts/hello/hello.manifest.json';
import Hello from '../src/webparts/hello/components/Hello';

const context = createMockWebPartContext(manifest, {
  properties: { description: 'Hello from solid' }
});

adapter.mount(
  document.getElementById('root')!,
  createComponent(Hello, { description: String(context.properties.description) })
);
