import { VanillaWebPart } from '@mbsks/rspfx-framework-vanilla/webpart';

export type IDemoWebPartProps = {
  description: string;
};

const CARD_STYLE = [
  'max-width:480px',
  'margin:24px auto',
  'padding:24px',
  'border:1px solid #e1dfdd',
  'border-radius:6px',
  'box-shadow:0 2px 8px rgba(0,0,0,0.08)',
  'font-family:"Segoe UI",sans-serif'
].join(';');

const TITLE_STYLE = ['margin:0 0 12px 0', 'color:#323130', 'font-size:20px'].join(';');

const LIST_STYLE = ['margin:0', 'padding-left:20px', 'color:#605e5c', 'line-height:1.8'].join(';');

export default class DemoWebPart extends VanillaWebPart<IDemoWebPartProps, unknown> {
  protected renderComponent(props: IDemoWebPartProps): HTMLElement {
    const card = document.createElement('div');
    card.className = 'demo-card';
    card.style.cssText = CARD_STYLE;

    const title = document.createElement('h2');
    title.style.cssText = TITLE_STYLE;
    title.textContent = props.description;
    card.appendChild(title);

    const list = document.createElement('ul');
    list.style.cssText = LIST_STYLE;
    for (const feature of ['Rspack-powered builds', 'Manifest generation', 'SPFx-compatible output', 'No webpack, no gulp']) {
      const item = document.createElement('li');
      item.textContent = feature;
      list.appendChild(item);
    }
    card.appendChild(list);

    return card;
  }
}
