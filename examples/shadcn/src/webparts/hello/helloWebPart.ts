import { createElement, type ReactElement } from 'react';
import { PropertyPaneTextField, type IPropertyPaneConfiguration } from '@microsoft/sp-property-pane';
import { ReactWebPart } from '@mbsks/rspfx-framework-react/webpart';
import Hello from './components/Hello';

type SPObject = { web: { absoluteUrl: string } };

export type IHelloWebPartProps = {
  description: string;
  userDisplayName: string;
  userEmail: string | undefined;
  userLoginName: string | undefined;
  siteUrl: string;
  webTitle: string;
  spAvailable: boolean;
};

export default class HelloWebPart extends ReactWebPart<IHelloWebPartProps, unknown> {
  private spAvailable = false;

  protected override async onInit(): Promise<void> {
    // First thing: get the SharePoint object from the web part context (SPFx 1.13+).
    const sp = (this.context as { sp?: unknown }).sp as SPObject | undefined;
    this.spAvailable = sp?.web?.absoluteUrl != null;
    await super.onInit();
  }

  protected override getComponentProps(): IHelloWebPartProps {
    const { pageContext } = this.context;
    return {
      description: this.properties.description,
      userDisplayName: pageContext.user.displayName,
      userEmail: pageContext.user.email,
      userLoginName: pageContext.user.loginName,
      siteUrl: pageContext.web.absoluteUrl,
      webTitle: pageContext.web.title,
      spAvailable: this.spAvailable
    };
  }

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
