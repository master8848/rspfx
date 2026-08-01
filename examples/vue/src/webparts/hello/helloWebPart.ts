import type { Component } from 'vue';
import { PropertyPaneTextField, type IPropertyPaneConfiguration } from '@microsoft/sp-property-pane';
import { VueWebPart } from '@mbsks/rspfx-framework-vue/webpart';
import Hello from './components/Hello.vue';

export type IHelloWebPartProps = {
  description: string;
};

export default class HelloWebPart extends VueWebPart<IHelloWebPartProps, unknown> {
  protected renderComponent(props: IHelloWebPartProps): Component {
    return Hello;
  }

  protected override getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: 'Vue Hello configuration' },
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
