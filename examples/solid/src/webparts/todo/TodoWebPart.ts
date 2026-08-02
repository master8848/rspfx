import { createComponent, type JSX } from 'solid-js';
import { SolidWebPart } from '@mbsks/rspfx-framework-solid/webpart';
import TodoApp from './components/TodoApp';
import {
  LocalTodoService,
  SharePointTodoService,
  type ISpHttpClientLike,
  type TodoService
} from './services/TodoService';

export type ITodoWebPartProps = Record<string, never>;

export default class TodoWebPart extends SolidWebPart<ITodoWebPartProps, unknown> {
  protected renderComponent(_props: ITodoWebPartProps): JSX.Element {
    const spHttpClient = this.context.spHttpClient as unknown as ISpHttpClientLike | undefined;
    const service: TodoService = spHttpClient
      ? new SharePointTodoService(spHttpClient, this.context.pageContext.web.absoluteUrl)
      : new LocalTodoService();
    return createComponent(TodoApp, { service });
  }
}
