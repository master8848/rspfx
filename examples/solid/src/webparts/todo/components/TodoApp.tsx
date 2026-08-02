import { createResource, createSignal, For, Show, type JSX } from 'solid-js';
import type { TodoItem, TodoService } from '../services/TodoService';

interface ITodoAppProps {
  service: TodoService;
}

const cardStyle: JSX.CSSProperties = {
  'max-width': '480px',
  margin: '24px auto',
  padding: '24px',
  border: '1px solid #e1dfdd',
  'border-radius': '6px',
  'box-shadow': '0 2px 8px rgba(0, 0, 0, 0.08)',
  'font-family': '"Segoe UI", sans-serif'
};

const titleStyle: JSX.CSSProperties = {
  margin: '0 0 16px 0',
  color: '#323130',
  'font-size': '20px'
};

const rowStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '8px',
  margin: '0 0 16px 0'
};

const inputStyle: JSX.CSSProperties = {
  flex: '1',
  padding: '6px 10px',
  'font-size': '14px',
  border: '1px solid #c8c6c4',
  'border-radius': '4px'
};

const buttonStyle: JSX.CSSProperties = {
  padding: '6px 14px',
  'font-size': '14px',
  border: 'none',
  'border-radius': '4px',
  background: '#0078d4',
  color: '#fff',
  cursor: 'pointer'
};

const listStyle: JSX.CSSProperties = {
  margin: '0',
  padding: '0',
  'list-style': 'none'
};

const itemStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '10px',
  'align-items': 'center',
  padding: '8px 4px',
  'border-bottom': '1px solid #edebe9',
  'font-size': '14px'
};

const doneStyle: JSX.CSSProperties = {
  flex: '1',
  color: '#a19f9d',
  'text-decoration': 'line-through'
};

const textStyle: JSX.CSSProperties = {
  flex: '1',
  color: '#323130'
};

const deleteStyle: JSX.CSSProperties = {
  border: 'none',
  background: 'none',
  color: '#a80000',
  cursor: 'pointer',
  'font-size': '13px'
};

const errorStyle: JSX.CSSProperties = {
  margin: '0 0 12px 0',
  color: '#a80000',
  'font-size': '13px'
};

export default function TodoApp(props: ITodoAppProps): JSX.Element {
  const [text, setText] = createSignal('');
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [todos, { refetch }] = createResource<TodoItem[], Error>(async () => {
    await props.service.ensureList();
    return props.service.getItems();
  });

  const addTodo = async (): Promise<void> => {
    const title = text().trim();
    if (!title) {
      return;
    }
    try {
      await props.service.addItem(title);
      setText('');
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const toggle = async (todo: TodoItem): Promise<void> => {
    try {
      await props.service.setCompleted(todo.Id, !todo.Completed);
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const remove = async (todo: TodoItem): Promise<void> => {
    try {
      await props.service.deleteItem(todo.Id);
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div style={cardStyle}>
      <h2 style={titleStyle}>Todos</h2>
      <div style={rowStyle}>
        <input
          style={inputStyle}
          value={text()}
          onInput={(event) => setText(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void addTodo();
            }
          }}
          placeholder="What needs to be done?"
        />
        <button style={buttonStyle} onClick={() => void addTodo()}>
          Add
        </button>
      </div>
      <Show when={error()}>
        <p style={errorStyle}>{error()}</p>
      </Show>
      <Show when={todos.loading}>
        <p style={{ ...textStyle, color: '#605e5c' }}>Loading…</p>
      </Show>
      <Show when={todos() && todos()!.length === 0}>
        <p style={{ ...textStyle, color: '#605e5c' }}>No todos yet — add one above.</p>
      </Show>
      <ul style={listStyle}>
        <For each={todos()}>
          {(todo) => (
            <li style={itemStyle}>
              <input
                type="checkbox"
                checked={todo.Completed}
                onChange={() => void toggle(todo)}
                aria-label={`Mark "${todo.Title}" as ${todo.Completed ? 'incomplete' : 'complete'}`}
              />
              <span style={todo.Completed ? doneStyle : textStyle}>{todo.Title}</span>
              <button style={deleteStyle} onClick={() => void remove(todo)}>
                Delete
              </button>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}
