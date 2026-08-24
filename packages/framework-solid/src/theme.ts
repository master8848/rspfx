import { createSignal, onCleanup } from 'solid-js';

export function createTheme<TTheme>(
  getTheme: () => TTheme | undefined,
  subscribe: (cb: (theme: TTheme | undefined) => void) => { dispose: () => void }
) {
  const [theme, setTheme] = createSignal<TTheme | undefined>(getTheme());
  const sub = subscribe(setTheme);
  onCleanup(() => sub.dispose());
  return theme;
}
