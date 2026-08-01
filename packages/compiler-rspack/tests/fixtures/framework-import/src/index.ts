import { ReactWebPart } from '@mbsks/rspfx-framework-react/webpart';
import type { ReactElement } from 'react';
import { createElement } from 'react';

export default class HelloWebPart extends ReactWebPart<{ description: string }, unknown> {
  protected renderComponent(props: { description: string }): ReactElement {
    return createElement('div', null, props.description);
  }
}
