import { PropertyPaneTextField, type IPropertyPaneConfiguration } from '@microsoft/sp-property-pane';
import { SvelteWebPart, type SvelteWebPartComponent } from '@mbsks/rspfx-framework-svelte/webpart';
import Hello from './components/Hello.svelte';

export type IHelloWebPartProps = {
  description: string;
};

export default class HelloWebPart extends SvelteWebPart<IHelloWebPartProps, unknown> {
  protected renderComponent(props: IHelloWebPartProps): SvelteWebPartComponent<IHelloWebPartProps> {
    return { component: Hello, props };
  }

  protected override getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: 'Svelte Hello configuration' },
          groups: [
            {
              groupName: 'Display',
              groupFields: [PropertyPaneTextField('description', { label: 'Description' })]
            }
          ]
        }
      ]
    };
  }
}
