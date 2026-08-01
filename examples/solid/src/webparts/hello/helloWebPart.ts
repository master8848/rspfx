import { createComponent, type JSX } from 'solid-js';
import { PropertyPaneTextField, type IPropertyPaneConfiguration } from '@microsoft/sp-property-pane';
import { SolidWebPart } from '@mbsks/rspfx-framework-solid/webpart';
import Hello from './components/Hello';

export type IHelloWebPartProps = {
  description: string;
};

export default class HelloWebPart extends SolidWebPart<IHelloWebPartProps, unknown> {
  protected renderComponent(props: IHelloWebPartProps): JSX.Element {
    return createComponent(Hello, props);
  }

  protected override getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: 'Solid Hello configuration' },
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
