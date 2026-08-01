import { Version } from '@microsoft/sp-core-library';
import { greeting } from './dep.js';
import styles from './styles.mod.scss';

export interface ITestWebPartProps {
  description: string;
}

export class TestWebPart {
  public render(): void {
    const version = Version.parse('1.0.0').toString();
    const el = document.createElement('div');
    el.className = styles.title ?? '';
    el.textContent = `${greeting} ${version}`;
    document.body.appendChild(el);
  }
}
