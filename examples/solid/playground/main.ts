import { createComponent } from 'solid-js';
import { createMockWebPartContext } from '@mbsks/rspfx-sharepoint-runtime';
import { adapter } from '@mbsks/rspfx-framework-solid';
import manifest from '../src/webparts/todo/todo.manifest.json';
import TodoApp from '../src/webparts/todo/components/TodoApp';
import { LocalTodoService } from '../src/webparts/todo/services/TodoService';

const context = createMockWebPartContext(manifest);

adapter.mount(
  document.getElementById('root')!,
  createComponent(TodoApp, { service: new LocalTodoService() })
);
