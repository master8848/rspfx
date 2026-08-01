import { createMockWebPartContext } from '@mbsks/rspfx-sharepoint-runtime';
import manifest from '../src/webparts/hello/hello.manifest.json';
import HelloWebPart from '../src/webparts/hello/helloWebPart';

const root = document.getElementById('root')!;
const context = createMockWebPartContext(manifest, {
  domElement: root,
  properties: { description: 'Hello from vanilla' }
});

const webPart = new HelloWebPart();
(webPart as unknown as { _internalInitialize(context: unknown): void })._internalInitialize(context);
webPart.render();
