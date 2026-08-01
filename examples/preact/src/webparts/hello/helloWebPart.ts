import { h, type ComponentChild } from 'preact';
import { PropertyPaneTextField, type IPropertyPaneConfiguration } from '@microsoft/sp-property-pane';
import { PreactWebPart } from '@mbsks/rspfx-framework-preact/webpart';
import Hello from './components/Hello';

export type IHelloWebPartProps = {
  description: string;
};

export default class HelloWebPart extends PreactWebPart<IHelloWebPartProps, unknown> {
  protected renderComponent(props: IHelloWebPartProps): ComponentChild {
    return h(Hello, props);
  }

  protected override getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: 'Preact Hello configuration' },
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
