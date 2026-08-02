import { h, render } from 'preact';
import { createMockWebPartContext } from '@mbsks/rspfx-sharepoint-runtime';
import manifest from '../src/webparts/hello/hello.manifest.json';
import Hello from '../src/webparts/hello/components/Hello';

const context = createMockWebPartContext(manifest, {
  properties: { description: 'Hello from preact' }
});

render(
  h(Hello, { description: String(context.properties.description) }),
  document.getElementById('root')!
);
