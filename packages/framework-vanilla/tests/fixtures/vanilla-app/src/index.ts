export default function createRootComponent(): HTMLElement {
  const root = document.createElement('div');
  root.textContent = 'hello vanilla';
  return root;
}
