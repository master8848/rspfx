import { createMockWebPartContext } from '@mbsks/rspfx-sharepoint-runtime';
import { adapter } from '@mbsks/rspfx-framework-svelte';
import manifest from '../src/webparts/hello/hello.manifest.json';
import Hello from '../src/webparts/hello/components/Hello.svelte';

const context = createMockWebPartContext(manifest, {
  properties: { description: 'Hello from svelte' }
});

adapter.mount(document.getElementById('root')!, Hello);
