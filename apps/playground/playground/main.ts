import { createMockWebPartContext } from '@mbsks/rspfx-sharepoint-runtime';
import manifest from '../src/webparts/demo/demo.manifest.json';
import DemoWebPart from '../src/webparts/demo/demoWebPart';

const root = document.getElementById('root')!;
const context = createMockWebPartContext(manifest, {
  domElement: root,
  properties: { description: 'Hello from the playground' }
});

const webPart = new DemoWebPart();
(webPart as unknown as { _internalInitialize(context: unknown): void })._internalInitialize(context);
webPart.render();
