import { createSignal } from 'solid-js';

const App = () => {
  const [count, setCount] = createSignal(0);
  return <div>hello solid {count()}</div>;
};

export default App;
