import { createElement, type ReactElement } from 'react';
import { PropertyPaneTextField, type IPropertyPaneConfiguration } from '@microsoft/sp-property-pane';
import { ReactWebPart } from '@mbsks/rspfx-framework-react/webpart';
import Hello from './components/Hello';

export type IHelloWebPartProps = {
  description: string;
};

export default class HelloWebPart extends ReactWebPart<IHelloWebPartProps, unknown> {
  protected renderComponent(props: IHelloWebPartProps): ReactElement {
    return createElement(Hello, props);
  }

  protected override getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: 'shadcn/ui Hello configuration' },
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
