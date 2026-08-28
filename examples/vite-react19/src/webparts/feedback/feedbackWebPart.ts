import { createElement, type ReactElement } from 'react';
import { PropertyPaneTextField, type IPropertyPaneConfiguration } from '@microsoft/sp-property-pane';
import { ReactWebPart } from '@mbsks/rspfx-framework-react/webpart';
import FeedbackForm from './components/FeedbackForm';
import type { WebPartContext } from '@microsoft/sp-webpart-base';

export interface IFeedbackWebPartProps {
  description: string;
  listTitle: string;
}

export default class FeedbackWebPart extends ReactWebPart<IFeedbackWebPartProps, unknown> {
  protected getComponentProps(): IFeedbackWebPartProps {
    return {
      description: this.properties.description ?? 'Feedback',
      listTitle: this.properties.listTitle ?? 'Feedback'
    };
  }

  protected renderComponent(props: IFeedbackWebPartProps): ReactElement {
    return createElement(FeedbackForm, {
      description: props.description,
      listTitle: props.listTitle,
      siteUrl: this.context.pageContext.web.absoluteUrl,
      context: this.context as unknown as WebPartContext
    });
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: 'Feedback form configuration' },
          groups: [
            {
              groupName: 'Data',
              groupFields: [
                PropertyPaneTextField('description', { label: 'Title' }),
                PropertyPaneTextField('listTitle', { label: 'List title' })
              ]
            }
          ]
        }
      ]
    };
  }
}
