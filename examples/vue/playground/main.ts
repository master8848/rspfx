import { defineComponent, h } from 'vue';
import { createMockWebPartContext } from '@mbsks/rspfx-sharepoint-runtime';
import { adapter } from '@mbsks/rspfx-framework-vue';
import manifest from '../src/webparts/hello/hello.manifest.json';
import Hello from '../src/webparts/hello/components/Hello.vue';

const context = createMockWebPartContext(manifest, {
  properties: { description: 'Hello from vue' }
});

const App = defineComponent({
  render: () => h(Hello, { description: String(context.properties.description) })
});

adapter.mount(document.getElementById('root')!, App);
