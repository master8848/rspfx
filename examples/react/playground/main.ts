import { createElement } from 'react';
import { createMockWebPartContext } from '@mbsks/rspfx-sharepoint-runtime';
import { adapter } from '@mbsks/rspfx-framework-react';
import manifest from '../src/webparts/hello/hello.manifest.json';
import Hello from '../src/webparts/hello/components/Hello';

const context = createMockWebPartContext(manifest, {
  properties: { description: 'Hello from react' }
});

adapter.mount(
  document.getElementById('root')!,
  createElement(Hello, { description: String(context.properties.description) })
);
