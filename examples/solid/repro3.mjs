import { Window } from '/Users/apple/code/spfx/node_modules/happy-dom/lib/index.js';

const win = new Window();
globalThis.window = win;
globalThis.document = win.document;
Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true });
globalThis.Node = win.Node;
globalThis.HTMLElement = win.HTMLElement;
globalThis.DocumentFragment = win.DocumentFragment;
globalThis.MutationObserver = win.MutationObserver;
globalThis.customElements = win.customElements;
globalThis.ShadowRoot = win.ShadowRoot;
globalThis.Event = win.Event;
globalThis.KeyboardEvent = win.KeyboardEvent;
globalThis.self = win;
globalThis.localStorage = win.localStorage;

const bundleName = process.env.BUNDLE ?? 'hello';
const bundlePath = `/tmp/solid-repro/dev-${bundleName}.js`;

let captured = null;
globalThis.define = (id, deps, factory) => {
  if (typeof deps === 'function') {
    factory = deps;
    deps = [];
  }
  captured = { id, deps, factory };
};

const fs = await import('node:fs');

class BaseClientSideWebPart {
  constructor() {
    this.domElement = document.createElement('div');
    this.properties = {};
    this.context = {
      domElement: this.domElement,
      properties: {},
      pageContext: { web: { title: 'T', absoluteUrl: 'https://contoso.sharepoint.com' }, site: { absoluteUrl: 'https://contoso.sharepoint.com' } }
    };
  }
  onInit() { return Promise.resolve(); }
  onDispose() {}
  render() {}
}

const mods = {
  '@microsoft/sp-webpart-base': { BaseClientSideWebPart, WebPartContext: class {} },
  '@microsoft/sp-property-pane': { PropertyPaneTextField: () => undefined, IPropertyPaneConfiguration: {} },
  '@microsoft/sp-http': { SPHttpClient: class { static configurations = { v1: {} } } }
};

const bundle = fs.readFileSync(bundlePath, 'utf8');
(0, eval)(bundle);
if (!captured) throw new Error('define not called');
const result = captured.factory(mods['@microsoft/sp-webpart-base'], mods['@microsoft/sp-property-pane'], mods['@microsoft/sp-http']);
const WebPartClass = typeof result === 'function' ? result : (result && result.default) ?? result;
if (typeof WebPartClass !== 'function') throw new Error('web part class not exported');

const instance = new WebPartClass();
const root = instance.domElement;
document.body.appendChild(root);
await instance.onInit();
instance.render();

console.log(`${bundleName} render -> childNodes: ${root.childNodes.length}`);
console.log(`${bundleName} textContent: ${JSON.stringify(root.textContent.slice(0, 80))}`);
console.log(`${bundleName} innerHTML head: ${JSON.stringify(root.innerHTML.slice(0, 120))}`);
