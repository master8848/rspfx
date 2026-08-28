import { Log } from '@microsoft/sp-core-library';
import { override } from '@microsoft/decorators';
import { BaseApplicationCustomizer } from '@microsoft/sp-application-base';

const LOG_SOURCE: string = 'BannerApplicationCustomizer';

export default class BannerApplicationCustomizer extends BaseApplicationCustomizer {
  @override
  public onInit(): Promise<void> {
    Log.info(LOG_SOURCE, 'Initialized banner');
    return super.onInit();
  }

  @override
  public onRender(): void {
    const placeholder = this.context.placeholderProvider.tryCreateContent('PageHeader');
    if (placeholder) {
      placeholder.domElement.innerHTML = `<div>Hello from ${LOG_SOURCE}</div>`;
    }
  }
}
