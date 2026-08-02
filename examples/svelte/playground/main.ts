import { createMockWebPartContext } from '@mbsks/rspfx-sharepoint-runtime';
import manifest from '../src/webparts/hello/hello.manifest.json';
import Hello from '../src/webparts/hello/components/Hello.svelte';

const context = createMockWebPartContext(manifest, {
  properties: { description: 'Hello from svelte' }
});

new Hello({
  target: document.getElementById('root')!,
  props: { description: String(context.properties.description) }
});
