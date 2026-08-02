import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { createMockWebPartContext } from '@mbsks/rspfx-sharepoint-runtime';
import manifest from '../src/webparts/hello/hello.manifest.json';
import Hello from '../src/webparts/hello/components/Hello';

const context = createMockWebPartContext(manifest, {
  properties: { description: 'Hello from shadcn' }
});

createRoot(document.getElementById('root')!).render(
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
