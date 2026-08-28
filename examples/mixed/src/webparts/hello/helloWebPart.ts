import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { PropertyPaneTextField, type IPropertyPaneConfiguration } from '@microsoft/sp-property-pane';
import Hello from './components/Hello';
import styles from './styles/Hello.module.scss';
import strings from 'HelloWebPartStrings';

export interface IHelloWebPartProps {
  description: string;
}

export default class HelloWebPart extends BaseClientSideWebPart<IHelloWebPartProps> {
  public get dataVersion(): string {
    return '1.0';
  }
  public render(): void {
    this.domElement.innerHTML = `<section class="${styles.Hello}">${Hello({ description: this.properties.description })}</section>`;
  }
  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: 'hello' },
          groups: [
            {
              groupName: 'Settings',
              groupFields: [
                PropertyPaneTextField('description', {
                  label: strings.Description
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
