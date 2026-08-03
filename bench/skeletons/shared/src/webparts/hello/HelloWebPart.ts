import { Version } from '@microsoft/sp-core-library';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';

export interface IHelloWebPartProps {
  description: string;
}

export default class HelloWebPart extends BaseClientSideWebPart<IHelloWebPartProps> {
  public render(): void {
    this.domElement.innerHTML = `<div class="hello">Hello, SPFx!</div>`;
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }
}
