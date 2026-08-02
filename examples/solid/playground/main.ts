import { createComponent } from 'solid-js';
import { render } from 'solid-js/web';
import { createMockWebPartContext } from '@mbsks/rspfx-sharepoint-runtime';
import manifest from '../src/webparts/todo/todo.manifest.json';
import TodoApp from '../src/webparts/todo/components/TodoApp';
import { LocalTodoService } from '../src/webparts/todo/services/TodoService';

const context = createMockWebPartContext(manifest);

render(
  () => createComponent(TodoApp, { service: new LocalTodoService() }),
  document.getElementById('root')!
);
