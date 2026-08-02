import { createElement } from 'react';
import { createMockWebPartContext } from '@mbsks/rspfx-sharepoint-runtime';
import { adapter } from '@mbsks/rspfx-framework-react';
import manifest from '../src/webparts/hello/hello.manifest.json';
import Hello from '../src/webparts/hello/components/Hello';

const context = createMockWebPartContext(manifest, {
  properties: { description: 'Hello from shadcn' }
});

adapter.mount(
  document.getElementById('root')!,
  createElement(Hello, {
    description: String(context.properties.description),
    userDisplayName: 'Alex (Playground)',
    userEmail: 'alex@contoso.com',
    userLoginName: 'i:0#.f|membership|alex@contoso.com',
    siteUrl: 'http://localhost:3000',
    webTitle: 'Local Workbench',
    spAvailable: false
  })
);
